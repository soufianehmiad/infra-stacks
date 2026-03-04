# cortex/api/tests/test_auth.py
import pytest
from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_round_trip():
    hashed = hash_password("secret123")
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_encodes_user_id():
    token = create_access_token(user_id=42)
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["type"] == "access"


def test_expired_token_raises():
    from app.core.security import create_access_token
    import time
    token = create_access_token(user_id=1, expires_minutes=-1)
    with pytest.raises(Exception):
        decode_token(token)
