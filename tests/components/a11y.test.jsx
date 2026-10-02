// @vitest-environment jsdom
// 3.4: accessibility of the shared components and forms (roles, names, keyboard, focus).
import { expectNoA11yViolations } from "./setup.jsx";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import FormField from "@/views/components/ui/FormField";
import IconLink from "@/views/components/ui/IconLink";
import LinkCourseModal from "@/app/dashboard/classes/_components/LinkCourseModal";
import Modal from "@/views/components/ui/Modal";
import Pagination from "@/views/components/ui/Pagination";
import RegisterForm from "@/views/sections/pages/register/RegisterForm";
import LoginForm from "@/views/sections/pages/login/Credentials/components/LoginForm";
import ReviewModal from "@/views/components/ui/ReviewModal";
import StarRating from "@/views/components/ui/StarRating";

describe("StarRating", () => {
  const Controlled = ({ initial = 0, onChange }) => {
    const [value, setValue] = useState(initial);
    return (
      <StarRating
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    );
  };

  it("read-only: an image with a text alternative", async () => {
    const { container } = render(<StarRating value={4} readOnly />);
    expect(screen.getByRole("img", { name: "4 de 5 estrellas" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("editable: a radio group operable with the keyboard", async () => {
    const onChange = vi.fn();
    const { container } = render(<Controlled initial={2} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    expect(screen.getByRole("radiogroup", { name: "Puntuación" })).toBeTruthy();
    expect(radios).toHaveLength(5);
    // Only the selected star is a tab stop
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1, -1]);
    expect(radios[1].getAttribute("aria-checked")).toBe("true");

    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(document.activeElement).toBe(radios[2]);
    fireEvent.keyDown(radios[2], { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(screen.getAllByRole("radio")[4], { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(1);
    await expectNoA11yViolations(container);
  });
});

describe("Modal", () => {
  const Harness = () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)} type="button">
          Abrir
        </button>
        {open && (
          <Modal title="Vincular clase" onClose={() => setOpen(false)}>
            <button type="button">Primero</button>
            <button type="button">Último</button>
          </Modal>
        )}
      </>
    );
  };

  it("labelled dialog: focus inside, Tab wraps, Escape closes and focus returns", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Vincular clase" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Primero" }));
    await expectNoA11yViolations(container);

    await user.tab();
    expect(document.activeElement.textContent).toBe("Último");
    await user.tab();
    expect(document.activeElement.textContent).toBe("Primero");
    await user.tab({ shift: true });
    expect(document.activeElement.textContent).toBe("Último");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("LinkCourseModal and ReviewModal pass axe and label their controls", async () => {
    const { container, unmount } = render(
      <LinkCourseModal
        classTitle="Clase"
        courses={[{ _id: "c1", title: "Curso" }]}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Curso" })).toBeTruthy();
    await expectNoA11yViolations(container);
    unmount();

    const review = render(
      <ReviewModal isOpen entityId="x" entityTitle="Clase" entityType="class" onClose={() => {}} />,
    );
    expect(screen.getByRole("radiogroup", { name: "Puntuación" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Comentario (opcional)" })).toBeTruthy();
    await expectNoA11yViolations(review.container);
  });
});

describe("IconLink", () => {
  it("icon-only controls are named by their title", () => {
    render(
      <>
        <IconLink asButton icon="Delete" onClick={() => {}} title="Eliminar" />
        <IconLink href="/x" icon="Eye" title="Ver detalles" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver detalles" })).toBeTruthy();
  });

  it("a disabled link is out of the tab order", () => {
    render(<IconLink disabled href="/x" icon="Eye" title="Ver" />);
    const link = screen.getByRole("link", { name: "Ver" });
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.tabIndex).toBe(-1);
  });

  it("warning buttons get a dark icon (white is unreadable on yellow)", () => {
    const { container } = render(<IconLink asButton warning icon="Pencil" title="Editar" />);
    expect(container.querySelector("svg").outerHTML).toContain("var(--color-7)");
  });
});

describe("forms", () => {
  it("FormField links the label and the error to the control", () => {
    render(
      <FormField label="Título" error="Debe contener al menos 3 caracteres">
        {(field) => <input {...field} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Título");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = document.getElementById(input.getAttribute("aria-describedby"));
    expect(described.textContent).toBe("Debe contener al menos 3 caracteres");
  });

  it("register and login fields have accessible names and autocomplete", async () => {
    const register = render(<RegisterForm />);
    for (const name of ["Nombre", "Apellido", "Email", "Contraseña"]) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("new-password");
    await expectNoA11yViolations(register.container);
    register.unmount();

    const login = render(<LoginForm />);
    expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe("current-password");
    expect(screen.getByRole("alert")).toBeTruthy();
    await expectNoA11yViolations(login.container);
  });

  it("register errors are announced on the invalid fields", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.click(screen.getByRole("button", { name: "Registrarse" }));
    const email = screen.getByLabelText("Email");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(email.getAttribute("aria-describedby")).textContent).not.toBe("");
  });
});

describe("Pagination", () => {
  it("is a named navigation with the current page marked", async () => {
    const { container } = render(<Pagination currentPage={2} totalPages={8} onPageChange={() => {}} />);
    expect(screen.getByRole("navigation", { name: "Paginación" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Página 2" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
