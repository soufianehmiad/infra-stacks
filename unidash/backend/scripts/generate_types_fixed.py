#!/usr/bin/env python3
import sys
sys.path.insert(0, '/opt/unidash/backend')

from app.models import base, service, auth, websocket, health
from pydantic import BaseModel
from typing import get_args, get_origin
from datetime import datetime
from enum import Enum

# Collect all models
models_to_export = []
for module in [base, service, auth, websocket, health]:
    for name in dir(module):
        obj = getattr(module, name)
        if isinstance(obj, type) and issubclass(obj, BaseModel) and obj != BaseModel:
            config = getattr(obj, 'model_config', {})
            if config.get('json_schema_extra', {}).get('ts_export'):
                models_to_export.append((name, obj))

# Generate TypeScript
ts_output = '''// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from Pydantic models at ''' + datetime.utcnow().isoformat() + '''Z
// Generator: backend/scripts/generate_types_fixed.py

/* eslint-disable */

'''

# Process StatusEnum first as type alias instead of enum
ts_output += '''export type StatusEnum = "running" | "stopped" | "paused" | "restarting" | "unknown";

'''

# Generate interfaces
for name, model in models_to_export:
    if 'Enum' in name:
        continue  # Skip enum models, already handled
    
    fields = model.model_fields
    ts_output += f'''/**
 * {model.__doc__ or name}
 */
export interface {name} {{
'''
    
    for field_name, field_info in fields.items():
        annotation = field_info.annotation
        ts_type = 'any'
        
        # Map Python types to TypeScript
        if annotation == str:
            ts_type = 'string'
        elif annotation == int or annotation == float:
            ts_type = 'number'
        elif annotation == bool:
            ts_type = 'boolean'
        elif annotation == datetime:
            ts_type = 'string'
        elif get_origin(annotation) == list:
            inner = get_args(annotation)[0]
            if inner == str:
                ts_type = 'string[]'
            elif inner == int or inner == float:
                ts_type = 'number[]'
            else:
                ts_type = 'any[]'
        elif get_origin(annotation) == dict:
            ts_type = 'Record<string, any>'
        elif hasattr(annotation, '__name__') and 'StatusEnum' in annotation.__name__:
            ts_type = 'StatusEnum'
        elif hasattr(annotation, '__name__'):
            ts_type = annotation.__name__
        
        # Handle Optional
        if get_origin(annotation) in [type(None) | type, None | type]:
            args = get_args(annotation)
            if len(args) == 2:
                ts_type = ts_type + ' | null'
        
        optional = '' if field_info.is_required() else '?'
        ts_output += f'  {field_name}{optional}: {ts_type};\n'
    
    ts_output += '}\n\n'

# Write TypeScript
with open('/opt/unidash/frontend/src/types/generated.ts', 'w') as f:
    f.write(ts_output)

print('��� Generated TypeScript types')
