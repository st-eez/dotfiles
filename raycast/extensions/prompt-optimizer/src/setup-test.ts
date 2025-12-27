/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");
const originalRequire = Module.prototype.require;

// @ts-expect-error overriding private api
Module.prototype.require = function (id, ...args) {
  if (id === "@raycast/api") {
    return {
      Icon: {
        Code: "code",
        Stars: "stars",
        Terminal: "terminal",
        TextDocument: "text-document",
        PlusCircle: "plus-circle",
        SaveDocument: "save-document",
        Document: "document",
        Eye: "eye",
        Clock: "clock",
      },
      showToast: () => {},
      Toast: { Style: { Success: "success", Failure: "failure", Animated: "animated" } },
      LocalStorage: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
      getSelectedText: () => Promise.resolve(""),
      useNavigation: () => ({ push: () => {}, pop: () => {} }),
      Color: { Blue: "blue", Green: "green" },
    };
  }
  return originalRequire.apply(this, [id, ...args]);
};
