/**
 * Turns database documents into plain JSON values (ObjectId → hex string,
 * Date → ISO string), the same shape the API returns. Server Components must do
 * this before passing data to Client Components, which only accept plain values.
 */
export const toPlain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
