import { Component } from 'react';

/**
 * Props every screen accepts. `brand` switches the white-label theme (`data-theme`); the other
 * keys are the design-preview props from the prototypes (e.g. `showError` on the login screens).
 */
export interface ScreenProps {
  brand?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [previewProp: string]: any;
}

/** Screen-local UI state (tabs, drafts, modal flags…). Loosely typed: it mirrors the prototype controllers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScreenState = Record<string, any>;

/**
 * Base class for ported screens. Each screen keeps the prototype's controller shape:
 * `state` + `setState` for local UI state, and `renderVals()` deriving everything the
 * markup binds to. `vals()` merges props under those values, exactly like the prototype
 * runtime did, so `v.brand` resolves to the prop unless the screen overrides it.
 */
export abstract class Screen extends Component<ScreenProps, ScreenState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract renderVals(): Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vals(): Record<string, any> {
    return { ...this.props, ...this.renderVals() };
  }
}
