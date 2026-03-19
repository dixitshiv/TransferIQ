import os


def configure_tracing():
    """
    Enable LangSmith tracing if LANGSMITH_API_KEY is set.
    Call once at application startup. No-op if key is absent.
    """
    api_key = os.getenv("LANGSMITH_API_KEY")
    if not api_key:
        print("[TransferIQ] LangSmith tracing disabled (LANGSMITH_API_KEY not set)")
        return

    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = api_key
    os.environ["LANGSMITH_PROJECT"] = os.getenv("LANGSMITH_PROJECT", "TransferIQ")
    print(f"[TransferIQ] LangSmith tracing enabled → project: {os.environ['LANGSMITH_PROJECT']}")
