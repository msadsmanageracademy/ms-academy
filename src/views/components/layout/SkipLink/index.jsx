"use client";

/**
 * "Saltar al contenido": first focusable element of every page, visible only on
 * keyboard focus. It moves the focus to the most specific content region:
 * an element marked with `data-skip-target` (e.g. the dashboard content, past the
 * sidebar) or, by default, the page's <main id="main-content">.
 * Without JavaScript the plain anchor still jumps to #main-content.
 */
const SkipLink = () => {
  const handleClick = (event) => {
    const target =
      document.querySelector("[data-skip-target]") ?? document.getElementById("main-content");
    if (!target) return;
    event.preventDefault();
    target.focus();
    target.scrollIntoView({ block: "start" });
  };

  return (
    <a className="skip-link" href="#main-content" onClick={handleClick}>
      Saltar al contenido
    </a>
  );
};

export default SkipLink;
