#!/usr/bin/env python3
"""
Automatic type generation from Pydantic models to TypeScript + Zod schemas.

This script:
1. Discovers all Pydantic models marked with ts_export=True
2. Generates TypeScript interfaces with full type information
3. Generates corresponding Zod validation schemas
4. Supports watch mode for development hot-reload
"""
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime
from typing import Any, get_origin, get_args
import importlib
import inspect

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from pydantic import BaseModel
from pydantic.fields import FieldInfo
from pydantic_core import PydanticUndefined


# Type mapping: Python → TypeScript
PYTHON_TO_TS_TYPE_MAP = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "dict": "Record<string, any>",
    "list": "Array<any>",
    "Any": "any",
    "None": "null",
    "datetime": "string",  # ISO 8601 string
}

# Type mapping: Python → Zod
PYTHON_TO_ZOD_TYPE_MAP = {
    "str": "z.string()",
    "int": "z.number().int()",
    "float": "z.number()",
    "bool": "z.boolean()",
    "dict": "z.record(z.any())",
    "list": "z.array(z.any())",
    "Any": "z.any()",
    "None": "z.null()",
    "datetime": "z.string().datetime()",  # ISO 8601 validation
}


def find_pydantic_models() -> list[type[BaseModel]]:
    """
    Discover all Pydantic models in app.models marked for export.

    Returns:
        List of model classes with ts_export=True in their config
    """
    models = []

    try:
        # Import all model modules
        from app.models import base, service, auth, websocket, health

        for module in [base, service, auth, websocket, health]:
            for name, obj in inspect.getmembers(module):
                if (
                    inspect.isclass(obj) and
                    issubclass(obj, BaseModel) and
                    obj is not BaseModel and
                    hasattr(obj, "model_config")
                ):
                    # Check if marked for export
                    config = obj.model_config
                    if isinstance(config, dict):
                        json_schema_extra = config.get("json_schema_extra", {})
                        if json_schema_extra.get("ts_export"):
                            models.append(obj)

    except Exception as e:
        print(f"❌ Error discovering models: {e}")
        return []

    return models


def python_type_to_typescript(field_type: Any, field_info: FieldInfo) -> str:
    """
    Convert Python type annotation to TypeScript type.

    Args:
        field_type: Python type annotation
        field_info: Pydantic field information

    Returns:
        TypeScript type string
    """
    # Handle None/Optional
    origin = get_origin(field_type)
    args = get_args(field_type)

    # Optional[X] or X | None
    if origin is type(None) or (origin and None in args):
        # Get the non-None type
        inner_type = next((arg for arg in args if arg is not type(None)), str)
        ts_type = python_type_to_typescript(inner_type, field_info)
        return f"{ts_type} | null"

    # List[X]
    if origin is list:
        if args:
            inner = python_type_to_typescript(args[0], field_info)
            return f"Array<{inner}>"
        return "Array<any>"

    # Dict[K, V]
    if origin is dict:
        if len(args) == 2:
            key_type = python_type_to_typescript(args[0], field_info)
            val_type = python_type_to_typescript(args[1], field_info)
            return f"Record<{key_type}, {val_type}>"
        return "Record<string, any>"

    # Literal["a", "b"]
    if origin is Literal:
        literals = " | ".join(f'"{arg}"' for arg in args)
        return literals

    # Union[X, Y]
    if origin is Union:
        types = " | ".join(python_type_to_typescript(arg, field_info) for arg in args)
        return types

    # Enum
    if inspect.isclass(field_type) and issubclass(field_type, Enum):
        return field_type.__name__

    # Pydantic model (nested)
    if inspect.isclass(field_type) and issubclass(field_type, BaseModel):
        return field_type.__name__

    # Basic types
    type_name = getattr(field_type, "__name__", str(field_type))
    return PYTHON_TO_TS_TYPE_MAP.get(type_name, "any")


def python_type_to_zod(field_type: Any, field_info: FieldInfo) -> str:
    """
    Convert Python type annotation to Zod schema.

    Args:
        field_type: Python type annotation
        field_info: Pydantic field information

    Returns:
        Zod schema string
    """
    origin = get_origin(field_type)
    args = get_args(field_type)

    # Optional[X] or X | None
    if origin is type(None) or (origin and None in args):
        inner_type = next((arg for arg in args if arg is not type(None)), str)
        zod_type = python_type_to_zod(inner_type, field_info)
        return f"{zod_type}.nullable()"

    # List[X]
    if origin is list:
        if args:
            inner = python_type_to_zod(args[0], field_info)
            return f"z.array({inner})"
        return "z.array(z.any())"

    # Dict[K, V]
    if origin is dict:
        if len(args) == 2:
            val_type = python_type_to_zod(args[1], field_info)
            return f"z.record({val_type})"
        return "z.record(z.any())"

    # Literal["a", "b"]
    if origin is Literal:
        literals = ", ".join(f'"{arg}"' for arg in args)
        return f"z.enum([{literals}])"

    # Union[X, Y]
    if origin is Union:
        types = ", ".join(python_type_to_zod(arg, field_info) for arg in args)
        return f"z.union([{types}])"

    # Enum
    if inspect.isclass(field_type) and issubclass(field_type, Enum):
        enum_values = ", ".join(f'"{v.value}"' for v in field_type)
        return f"z.enum([{enum_values}])"

    # Pydantic model (nested)
    if inspect.isclass(field_type) and issubclass(field_type, BaseModel):
        return f"{field_type.__name__}Schema"

    # Basic types with constraints
    type_name = getattr(field_type, "__name__", str(field_type))
    base_zod = PYTHON_TO_ZOD_TYPE_MAP.get(type_name, "z.any()")

    # Add constraints from field_info
    constraints = []
    if hasattr(field_info, "min_length") and field_info.min_length is not None:
        constraints.append(f".min({field_info.min_length})")
    if hasattr(field_info, "max_length") and field_info.max_length is not None:
        constraints.append(f".max({field_info.max_length})")
    if hasattr(field_info, "ge") and field_info.ge is not None:
        constraints.append(f".gte({field_info.ge})")
    if hasattr(field_info, "le") and field_info.le is not None:
        constraints.append(f".lte({field_info.le})")

    # Add default if present
    if field_info.default is not PydanticUndefined and field_info.default is not None:
        if isinstance(field_info.default, (str, int, float, bool)):
            constraints.append(f".default({json.dumps(field_info.default)})")

    return base_zod + "".join(constraints)


def generate_typescript(models: list[type[BaseModel]], output_path: Path):
    """Generate TypeScript interfaces from Pydantic models"""

    # Header
    ts_code = f"""// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from Pydantic models at {datetime.utcnow().isoformat()}Z
// Generator: backend/scripts/generate_types.py

/* eslint-disable */

"""

    # Generate enums first
    for model in models:
        for field_name, field_info in model.model_fields.items():
            field_type = field_info.annotation
            if inspect.isclass(field_type) and issubclass(field_type, Enum):
                ts_code += f"export enum {field_type.__name__} {{\n"
                for member in field_type:
                    ts_code += f'  {member.name} = "{member.value}",\n'
                ts_code += "}\n\n"

    # Generate interfaces
    for model in models:
        # Add JSDoc comment with description
        if model.__doc__:
            ts_code += f"/**\n * {model.__doc__.strip()}\n */\n"

        ts_code += f"export interface {model.__name__} {{\n"

        for field_name, field_info in model.model_fields.items():
            # Field description
            if field_info.description:
                ts_code += f"  /** {field_info.description} */\n"

            # Field type
            ts_type = python_type_to_typescript(field_info.annotation, field_info)

            # Optional marker
            is_required = field_info.is_required()
            optional_marker = "" if is_required else "?"

            ts_code += f"  {field_name}{optional_marker}: {ts_type};\n"

        ts_code += "}\n\n"

    output_path.write_text(ts_code)
    print(f"✅ Generated TypeScript types: {output_path}")


def generate_zod_schemas(models: list[type[BaseModel]], output_path: Path):
    """Generate Zod validation schemas from Pydantic models"""

    # Header
    zod_code = f"""// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from Pydantic models at {datetime.utcnow().isoformat()}Z
// Generator: backend/scripts/generate_types.py

/* eslint-disable */

import {{ z }} from 'zod';

"""

    # Generate schemas
    for model in models:
        schema_name = f"{model.__name__}Schema"

        # Add JSDoc
        if model.__doc__:
            zod_code += f"/**\n * {model.__doc__.strip()}\n */\n"

        zod_code += f"export const {schema_name} = z.object({{\n"

        for field_name, field_info in model.model_fields.items():
            zod_type = python_type_to_zod(field_info.annotation, field_info)

            # Handle optional fields
            if not field_info.is_required():
                zod_type = f"{zod_type}.optional()"

            zod_code += f"  {field_name}: {zod_type},\n"

        zod_code += "});\n\n"

        # Add type export for convenience
        zod_code += f"export type {model.__name__} = z.infer<typeof {schema_name}>;\n\n"

    output_path.write_text(zod_code)
    print(f"✅ Generated Zod schemas: {output_path}")


def generate_all():
    """Generate all type files"""
    print("🔄 Discovering Pydantic models...")
    models = find_pydantic_models()

    if not models:
        print("⚠️  No models found with ts_export=True")
        return

    print(f"📦 Found {len(models)} models: {', '.join(m.__name__ for m in models)}")

    # Output paths
    frontend_dir = Path(__file__).parent.parent.parent / "frontend" / "src"
    types_dir = frontend_dir / "types"
    schemas_dir = frontend_dir / "schemas"

    # Create directories
    types_dir.mkdir(parents=True, exist_ok=True)
    schemas_dir.mkdir(parents=True, exist_ok=True)

    # Generate files
    generate_typescript(models, types_dir / "generated.ts")
    generate_zod_schemas(models, schemas_dir / "generated.ts")

    print("✨ Type generation complete!")


def watch_mode():
    """Watch for model changes and regenerate types"""
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler

    class ModelChangeHandler(FileSystemEventHandler):
        def on_modified(self, event):
            if event.src_path.endswith(".py") and "models" in event.src_path:
                print(f"\n🔄 Model changed: {event.src_path}")
                try:
                    generate_all()
                except Exception as e:
                    print(f"❌ Generation failed: {e}")

    models_dir = Path(__file__).parent.parent / "app" / "models"

    observer = Observer()
    observer.schedule(ModelChangeHandler(), path=str(models_dir), recursive=True)
    observer.start()

    print(f"👀 Watching for changes in {models_dir}")
    print("Press Ctrl+C to stop")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n👋 Stopped watching")

    observer.join()


def main():
    parser = argparse.ArgumentParser(
        description="Generate TypeScript types and Zod schemas from Pydantic models"
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Watch for model changes and regenerate automatically"
    )

    args = parser.parse_args()

    # Initial generation
    generate_all()

    # Watch mode if requested
    if args.watch:
        watch_mode()


if __name__ == "__main__":
    # Import necessary types
    from enum import Enum
    from typing import Union, Literal

    main()
