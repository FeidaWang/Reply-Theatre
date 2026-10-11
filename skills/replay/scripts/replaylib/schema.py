"""Dependency-free validation of the JSON Schema subset used by replay-v1."""
from datetime import datetime
from functools import lru_cache
import json
from pathlib import Path
from .history import HistoryError


@lru_cache(maxsize=2)
def replay_schema(version=1):
    if version not in {1,2}:
        raise HistoryError("Unsupported replay schemaVersion")
    return json.loads((Path(__file__).resolve().parents[2] / f"schemas/replay-v{version}.json").read_text(encoding="utf-8"))


def validate_schema(value, schema=None, root=None, path="dataset"):
    schema = schema or replay_schema()
    root = root or schema
    if "$ref" in schema:
        target = root
        for part in schema["$ref"].split("/")[1:]:
            target = target[part]
        return validate_schema(value, target, root, path)
    if "const" in schema and (type(value) is not type(schema["const"]) or value != schema["const"]):
        raise HistoryError(f"{path}: invalid constant")
    if "enum" in schema and value not in schema["enum"]:
        raise HistoryError(f"{path}: unsupported value")
    types = schema.get("type", [])
    types = [types] if isinstance(types, str) else types
    checks = {"object": isinstance(value, dict), "array": isinstance(value, list), "string": isinstance(value, str),
              "integer": type(value) is int, "number": type(value) in {int, float}, "boolean": type(value) is bool, "null": value is None}
    if types and not any(checks[t] for t in types):
        raise HistoryError(f"{path}: invalid type")
    if isinstance(value, dict):
        if any(key not in value for key in schema.get("required", [])):
            raise HistoryError(f"{path}: missing required fields")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False and any(key not in properties for key in value):
            raise HistoryError(f"{path}: unknown fields")
        for key, item in value.items():
            if key in properties:
                validate_schema(item, properties[key], root, f"{path}.{key}")
    elif isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            validate_schema(item, schema["items"], root, f"{path}[{index}]")
    elif isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            raise HistoryError(f"{path}: empty text")
        if schema.get("format") == "date-time":
            try:
                if datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is None:
                    raise ValueError("missing timezone")
            except ValueError as error:
                raise HistoryError(f"{path}: invalid timestamp") from error
    elif type(value) in {int, float} and value < schema.get("minimum", float("-inf")):
        raise HistoryError(f"{path}: number below minimum")
