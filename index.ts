console.log("Hello via Bun!");

// Path: index.ts
export async function testJobProcess(server: string, job: number) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
