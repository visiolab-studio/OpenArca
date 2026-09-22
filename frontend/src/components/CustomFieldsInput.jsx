import { useState } from "react";
import { useTranslation } from "react-i18next";

// Renders a project's custom field definitions as inputs.
//
// These fields are CONTEXT, not the primary input, so they sit in their own
// quiet group rather than competing with title and description. A project with
// no custom fields renders nothing at all — the form must stay usable when the
// feature is unused, which is the common case.

const INPUT_TYPE_BY_FIELD_TYPE = {
  text: "text",
  number: "number",
  url: "url",
  date: "date"
};

export default function CustomFieldsInput({ definitions, values, errors, onChange, disabled, compactOptional = false }) {
  const { t } = useTranslation();
  const [optionalOpen, setOptionalOpen] = useState(false);

  if (!Array.isArray(definitions) || definitions.length === 0) {
    return null;
  }

  function renderField(definition) {
    const value = values?.[definition.field_key] ?? "";
    const error = errors?.[definition.field_key];
    const inputId = `custom-field-${definition.field_key}`;
    const describedBy = error ? `${inputId}-error` : undefined;

    return (
      <div className="form-group" key={definition.field_key}>
        <label className="form-label" htmlFor={inputId}>
          {definition.label}
          {definition.required ? <span aria-hidden="true"> *</span> : null}
        </label>

        {definition.field_type === "select" ? (
          <select
            id={inputId}
            className="form-select"
            value={value}
            required={definition.required}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(definition.field_key, event.target.value)}
          >
            <option value="">{t("tickets.customFieldChoose")}</option>
            {definition.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={inputId}
            className="form-input"
            type={INPUT_TYPE_BY_FIELD_TYPE[definition.field_type] || "text"}
            value={value}
            required={definition.required}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={describedBy}
            onChange={(event) => onChange(definition.field_key, event.target.value)}
          />
        )}

        {error ? (
          <small className="form-error" id={`${inputId}-error`} role="alert">
            {error}
          </small>
        ) : null}
      </div>
    );
  }

  const requiredFields = definitions.filter((definition) => definition.required);
  const optionalFields = definitions.filter((definition) => !definition.required);
  const hasOptionalErrors = optionalFields.some((definition) => errors?.[definition.field_key]);

  return (
    <fieldset className={compactOptional ? "custom-fields custom-fields-compact" : "custom-fields"} disabled={disabled}>
      <legend className="form-label">{t("tickets.customFields")}</legend>
      <p className="form-hint">{t("tickets.customFieldsHint")}</p>
      {compactOptional ? (
        <>
          {requiredFields.map(renderField)}
          {optionalFields.length > 0 ? (
            <details
              className="custom-fields-optional"
              open={optionalOpen || hasOptionalErrors}
              onToggle={(event) => setOptionalOpen(event.currentTarget.open)}
            >
              <summary>{t("tickets.optionalFields", { count: optionalFields.length })}</summary>
              <div className="custom-fields-optional-grid">{optionalFields.map(renderField)}</div>
            </details>
          ) : null}
        </>
      ) : definitions.map(renderField)}
    </fieldset>
  );
}
