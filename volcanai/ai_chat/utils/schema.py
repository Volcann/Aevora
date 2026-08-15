import google.generativeai as genai


def _mcp_schema_to_gemini(schema: dict):
    if not schema or schema.get("type") != "object":
        return None

    properties = {}
    type_map = {
        "string": genai.protos.Type.STRING,
        "integer": genai.protos.Type.INTEGER,
        "number": genai.protos.Type.NUMBER,
        "boolean": genai.protos.Type.BOOLEAN,
        "array": genai.protos.Type.ARRAY,
        "object": genai.protos.Type.OBJECT,
    }

    for prop_name, prop_def in schema.get("properties", {}).items():
        prop_type = type_map.get(
            prop_def.get("type", "string"),
            genai.protos.Type.STRING,
        )
        properties[prop_name] = genai.protos.Schema(
            type_=prop_type,
            description=prop_def.get("description", ""),
        )

    return genai.protos.Schema(
        type_=genai.protos.Type.OBJECT,
        properties=properties,
        required=schema.get("required", []),
    )
