// Thin entrypoint that delegates to the existing Worker implementation in src/index.js
import worker, { MyDurableObject } from "../src/index.js";

export { MyDurableObject };
export default worker;
