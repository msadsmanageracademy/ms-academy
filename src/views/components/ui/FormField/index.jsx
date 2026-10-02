"use client";

import { useId } from "react";

/**
 * Label + control + error message, wired for assistive technology:
 * the label points to the control, and the error is announced through
 * aria-describedby / aria-invalid.
 *
 * `children` receives the props to spread on the control:
 *   <FormField label="Título" error={errors.title?.message} ...>
 *     {(field) => <input {...register("title")} {...field} />}
 *   </FormField>
 *
 * The markup (row + error below) matches the existing forms; `hideLabel` keeps
 * the label for screen readers only (forms that rely on placeholders).
 */
const FormField = ({
  label,
  error,
  hideLabel = false,
  rowClassName,
  labelClassName,
  errorClassName,
  children,
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const field = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };

  return (
    <>
      <div className={rowClassName}>
        <label className={hideLabel ? "visually-hidden" : labelClassName} htmlFor={id}>
          {label}
        </label>
        {children(field)}
      </div>
      <div className={errorClassName} id={errorId}>
        {error}
      </div>
    </>
  );
};

export default FormField;
