## Project overview

- Quran Lock is an Expo app using React Native, React, TypeScript, and Expo Router.
- Application code lives in `src/`; route files live in `src/app/`.
- Use the `@/` alias for imports from `src/`.
- The app uses the React Native New Architecture and typed Expo Router routes.

## Commands

- Install dependencies: `yarn install --frozen-lockfile`.
- Start the Expo development server: `yarn start`.
- Run the iOS app: `yarn ios`.
- Run the Android app: `yarn android`.
- Run linting: `yarn lint`.
- Run TypeScript type-checking: `yarn tsc --noEmit`.
- Run all tests: `yarn test`.
- Run a targeted test: `yarn vitest run <path-to-test>`.

## Development guidelines

- Write function components and idiomatic React hooks, but do not add manual memoization with `useCallback`, `useMemo`, `React.memo`, or `memo`.
- Avoid `useEffect` unless it is the only appropriate way to synchronize with an external system. Prefer derived values, event handlers, query callbacks, subscriptions, or other purpose-built APIs when they cover the scenario more directly.
- Use arrow functions instead of function declarations, including for components, hooks, callbacks, and helpers.
- Never use `any` as a type. Use an accurate type, `unknown` with narrowing, or an existing project type instead.
- Keep types simple and readable. Prefer inference and straightforward interfaces or type aliases over unnecessary generics, conditional types, and complicated type abstractions.
- Do not use the `void` operator to call a function (for example, `void loadData()`). Call and handle the function normally, and explicitly handle async errors when needed.
- Do not add unnecessary accessibility props as boilerplate, including `accessibilityRole`, `accessibilityLabel`, or `accessibilityState`. Use them only when the component has a specific accessibility requirement that is not already handled by the underlying native component.
- When editing existing code that uses manual memoization, remove it when it is safe and within the scope of the change.
- Keep route components focused on routing and screen composition. Put reusable UI in `src/components/`, shared behavior in `src/hooks/`, API logic in `src/services/` or `src/lib/`, and shared state in `src/store/`.
- Do not use unexplained magic numbers or strings in application logic. Reuse an existing named constant from `src/constants/`, or create a clearly named feature constants file there when one does not exist.
- Every source-code folder outside `src/app/` must have an `index.ts` barrel that exports its public modules. Import through the barrel where practical. Route folders under `src/app/` are exempt because Expo Router uses their file structure directly.
- Follow DRY and the Single Responsibility Principle: reuse shared logic, keep each component, hook, and module focused on one responsibility, and extract duplication only when it creates a clear reusable concept. Follow React Native best practices for performance, platform behavior, styling, navigation, state, and resource cleanup.
- Keep state as close as possible to the component that owns and uses it to limit re-renders. Lift state or place it in a shared store only when multiple consumers genuinely need the same source of truth.
- Do not leave comments in the code. Add a comment only when an unavoidable workaround or patch cannot be made clear through the code itself, and keep it to one or two lines maximum.
- Preserve strict TypeScript typing. Avoid unsafe casts and suppressing compiler or lint errors.
- Reuse existing constants, utilities, components, and query keys before creating new ones.
- Follow the existing feature-based folder structure and nearby naming/style conventions.
- Handle loading, empty, error, and offline states for user-facing asynchronous flows.
- Never hardcode credentials, API keys, tokens, or other secrets. Use the existing environment/configuration pattern.
