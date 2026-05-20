# Security

Please report security issues through the repository's private vulnerability
reporting channel if one is enabled. If not, open a minimal public issue that
states there is a security concern without posting exploit details or secrets.

## Handling Secrets

Do not commit API keys, exported browser profiles, packed extension keys, or
release archives. The project `.gitignore` excludes common secret and packaged
extension file types.

TimeBack does not ship an OpenRouter key. Users who enable off-site unsubscribe
assistance provide their own key, which is stored locally in Chrome extension
storage and can be cleared from the popup.
