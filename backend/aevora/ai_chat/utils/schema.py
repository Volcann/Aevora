import google.generativeai as genai

TYPE_MAP = {
    "string": genai.protos.Type.STRING,
    "integer": genai.protos.Type.INTEGER,
    "number": genai.protos.Type.NUMBER,
    "boolean": genai.protos.Type.BOOLEAN,
    "array": genai.protos.Type.ARRAY,
    "object": genai.protos.Type.OBJECT,
}


def schema_to_gemini(schema: dict):
    if not schema or schema.get("type") != "object":
        return None

    props = {}
    for name, pdef in schema.get("properties", {}).items():
        props[name] = genai.protos.Schema(
            type=TYPE_MAP.get(pdef.get("type", "string"), genai.protos.Type.STRING),
            description=pdef.get("description", ""),
        )

    return genai.protos.Schema(
        type=genai.protos.Type.OBJECT,
        properties=props,
        required=schema.get("required", []),
    )
