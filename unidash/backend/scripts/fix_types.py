#!/usr/bin/env python3
import re

# Read generated types
with open('/opt/unidash/frontend/src/types/generated.ts', 'r') as f:
    content = f.read()

# Remove duplicate enums - keep only first occurrence
seen_enums = set()
lines = content.split('\n')
output_lines = []
in_enum = False
current_enum = None
skip_enum = False

for line in lines:
    if line.startswith('export enum '):
        enum_name = line.split()[2]
        if enum_name in seen_enums:
            skip_enum = True
            in_enum = True
        else:
            seen_enums.add(enum_name)
            skip_enum = False
            in_enum = True
            output_lines.append(line)
    elif in_enum and line == '}':
        if not skip_enum:
            output_lines.append(line)
        in_enum = False
        skip_enum = False
    elif not skip_enum:
        output_lines.append(line)

# Write back
with open('/opt/unidash/frontend/src/types/generated.ts', 'w') as f:
    f.write('\n'.join(output_lines))

print('��� Fixed duplicate enums')
