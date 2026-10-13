import json
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any
from fastapi import HTTPException
from config import settings

def verify_google_token(token: str) -> Dict[str, Any]:
    """
    Verifies a Google OAuth 2.0 / Google Identity Services ID token.
    Calls Google's tokeninfo endpoint to validate signature, expiration, and audience.
    """
    if not token or not token.strip():
        raise HTTPException(status_code=400, detail="Missing Google ID token")

    clean_token = token.strip()
    encoded_token = urllib.parse.quote(clean_token)
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={encoded_token}"

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "YelpCamp-Server/2.0"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            raw_body = resp.read().decode("utf-8")
            data = json.loads(raw_body)
    except urllib.error.HTTPError as e:
        err_msg = "Google token verification failed"
        try:
            err_data = json.loads(e.read().decode("utf-8"))
            err_msg = err_data.get("error_description", err_data.get("error", err_msg))
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=f"Google Authentication Error: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with Google authentication server: {str(e)}")

    # Audience check: must match our GOOGLE_CLIENT_ID
    aud = data.get("aud")
    if aud != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=401, 
            detail="Google token audience mismatch (client ID does not match server)"
        )

    # Issuer check
    iss = data.get("iss")
    if iss not in ["accounts.google.com", "https://accounts.google.com"]:
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")

    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google token does not provide an email address")

    return {
        "sub": data.get("sub"),
        "email": email,
        "name": data.get("name") or email.split("@")[0],
        "given_name": data.get("given_name"),
        "picture": data.get("picture"),
        "email_verified": data.get("email_verified") in [True, "true", "True"]
    }
