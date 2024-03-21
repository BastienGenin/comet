import { version } from "./package.json";
import { Command } from "@commander-js/extra-typings";
import ollama from "ollama";
import { $ } from "zx";

$.shell = true;

new Command()
  .name("Comet")
  .description("Comet CLI")
  .version(version)
  .action(async () => {
    const response = await ollama.chat({
      model: "codellama:13b",
      messages: [{ role: "user", content: "Why is the sky blue?" }],
      stream: true,
    });

    for await (const part of response) {
      process.stdout.write(part.message.content);
    }
  })
  .parse();
