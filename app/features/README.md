# Feature modules

Feature folders own their domain-specific data, puzzle rules, and screens. They may depend on shared utilities in `lib/`, but shared utilities must not import a feature.

The intended dependency direction is:

```text
Expo route → feature screen → feature puzzle/data modules → shared lib/API
```

Keep multiplayer transport, encryption, and generic hub discovery reusable. Keep McKinney history, observations, and field-test content inside `features/mckinney`.
