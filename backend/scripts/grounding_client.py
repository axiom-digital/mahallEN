"""Explicit Gemini Search API client. Importing never calls the provider."""


def generate_research(*, api_key, model, prompt, max_output_tokens=4096):
    if not api_key or not model or not prompt.strip():
        raise ValueError('API key, model and prompt are required')
    if len(prompt) > 20000 or not 256 <= max_output_tokens <= 8192:
        raise ValueError('Research request exceeds configured limits')
    # Kept in requirements-grounding.txt so ordinary M1 API reads need no live SDK setup.
    from google import genai
    from google.genai import types

    with genai.Client(api_key=api_key, http_options=types.HttpOptions(
        timeout=90000, retry_options=types.HttpRetryOptions(attempts=1)
    )) as client:
        return client.models.generate_content(
            model=model, contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=.2, max_output_tokens=max_output_tokens,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
