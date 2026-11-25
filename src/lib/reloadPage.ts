/** A full page load: the one retry that works when the root layout itself failed. An object so tests can spy on it. */
export const reloadPage = {
  run(): void {
    window.location.reload();
  },
};
