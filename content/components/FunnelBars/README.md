# FunnelBars

An example of a vault component: the Examples vault's own, not built into the app. Slidecraft
bundles `index.tsx` and loads it while this vault is open, so its decks, the editor and the
Component Gallery know `<FunnelBars>`.

A component folder may import `slidecraft`, `react`, `react/jsx-runtime`, `motion/react` and
files in its own folder. Its `defineComponent` name must be the folder's name.
