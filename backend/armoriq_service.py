"""
ArmorIQ Service — Cryptographic Trust Anchor

Uses HMAC-SHA256 with ARMORIQ_API_KEY as the signing secret.
The key is used to authenticate the signature, providing a verifiable
chain of trust anchored to the ArmorIQ credential.

Merkle Tree: Each allowed action is a leaf node. The root binds the
entire allowed-action set cryptographically to the intent contract.
"""
import hashlib
import hmac
import json
import os
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

ARMORIQ_API_KEY = os.getenv("ARMORIQ_API_KEY", "armoriq_local_dev_secret")


def _compute_merkle_root(actions: list[str]) -> str:
    """
    Computes a Merkle root over the allowed_actions list.
    Each leaf is the SHA-256 hash of an action name.
    Pairs are hashed together level by level until one root remains.
    """
    if not actions:
        return hashlib.sha256(b"empty").hexdigest()

    leaves = [hashlib.sha256(a.encode()).hexdigest() for a in sorted(actions)]

    level = leaves
    while len(level) > 1:
        next_level = []
        for i in range(0, len(level), 2):
            left = level[i]
            right = level[i + 1] if i + 1 < len(level) else left
            combined = hashlib.sha256((left + right).encode()).hexdigest()
            next_level.append(combined)
        level = next_level

    return level[0]


def generate_intent_contract(goal: str, allowed_actions: list) -> dict:
    """
    ArmorIQ Intent Signing:
    1. Serializes goal + sorted allowed_actions + timestamp into canonical JSON
    2. SHA-256 hashes it → intent_hash
    3. HMAC-SHA256 signs the hash using ARMORIQ_API_KEY → signature
    4. Builds Merkle root over allowed actions
    5. Returns the full signed contract
    """
    timestamp = datetime.utcnow().isoformat()
    sorted_actions = sorted(allowed_actions)

    intent_payload = {
        "goal": goal,
        "allowed_actions": sorted_actions,
        "timestamp": timestamp,
    }

    # Canonical serialization — deterministic regardless of dict insertion order
    serialized = json.dumps(intent_payload, separators=(',', ':'), sort_keys=True)

    # SHA-256 intent hash
    intent_hash = hashlib.sha256(serialized.encode('utf-8')).hexdigest()

    # HMAC-SHA256 signature using ArmorIQ API key
    hmac_sig = hmac.new(
        ARMORIQ_API_KEY.encode('utf-8'),
        intent_hash.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # ArmorIQ signature format
    signature = f"armoriq_v3_hmac_{hmac_sig[:32]}_{intent_hash[:8]}"

    # Merkle root over allowed actions
    merkle_root = _compute_merkle_root(sorted_actions)

    # Agent identity derived from intent hash + ARMORIQ key fingerprint
    key_fingerprint = hashlib.sha256(ARMORIQ_API_KEY.encode()).hexdigest()[:8]
    agent_id = f"agent_{intent_hash[:8]}_{key_fingerprint}"

    return {
        "intent_hash": intent_hash,
        "merkle_root": merkle_root,
        "signature": signature,
        "agent_id": agent_id,
        "allowed_actions": allowed_actions,
        "goal": goal,
        "created_at": timestamp,
        "version": "ArmorIQ-v3.0",
    }


def verify_signature(intent_hash: str, signature: str) -> bool:
    """
    Verify that a signature was produced by this ArmorIQ key.
    Used to authenticate inbound requests from external agents.
    """
    expected_hmac = hmac.new(
        ARMORIQ_API_KEY.encode('utf-8'),
        intent_hash.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    expected_sig = f"armoriq_v3_hmac_{expected_hmac[:32]}_{intent_hash[:8]}"
    return hmac.compare_digest(signature, expected_sig)


def verify_action_against_contract(attempted_action: str, allowed_actions: list) -> bool:
    """
    Evaluates whether the executing engine action resides safely within
    the boundaries cryptographically signed in the original intent contract.
    """
    return attempted_action in allowed_actions