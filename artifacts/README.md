# Retained prototypes

`spare-cad/` retains the previous frontend preview, installation dialog, CSS,
fonts, phone screenshots, verification records, design notes, and original
scripts. They are source artifacts, **not** an additional server or public static
root. Do not run those scripts as the current deployment.

Nathan can reuse their content and styles in a future installation dropdown or
page. This integration adds no extension links or UI changes to `web/`.
The active setup page is maintained in `roundups/public/` and reached directly
at `/roundups/`; the server never maps HTTP requests into `artifacts/`.
