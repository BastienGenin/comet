import { version } from "./package.json";
import * as p from "@clack/prompts";
import { Command } from "@commander-js/extra-typings";
import ollama from "ollama";
import color from "picocolors";
import { $ } from "zx/core";

$.verbose = false;

const s = p.spinner();

const SYSTEM_PROMPT = `Your only goal is to retrieve a single commit message.
	Based on the provided output of a \`$ git diff --staged\`, create ONE SINGLE commit message retrieving the global idea, following strictly the next rules:
	Output directly only one commit message in plain text.
	Do not add any issues numeration nor explain your output.
	Do not prepend the output with any prefix nor suffix.
	Do not add context like "Here is the commit message: ...".
	Use imperative.
	One line only, 50 words max.
	Be clear and concise.
	Do not put message in quotes.
	Always provide only the commit message as answer`;

new Command()
  .name("Comet")
  .description("Comet CLI")
  .version(version)
  .action(async () => {
    p.intro(`${color.bgBlue(color.white(" Comet CLI "))}`);

    // 1.a Check if the current directory is a git repository
    const { stdout: response } = await $`git rev-parse --is-inside-work-tree`;
    if (response.trim() !== "true") {
      throw new Error("Not a git repository.");
    }
    // 1.b Check the git status
    const { stdout: gitStatus } =
      await $`git ls-files . --exclude-standard --others -m`;

    // 2. Format the staged/unstaged files
    const groupedFileList = formatFiles(gitStatus);
    if (Object.keys(groupedFileList).length === 0) {
      p.outro("No files to stage.");
      return;
    }

    await p.group({
      // 3.a Display the files to the user and let him select the files to stage
      stage: async () => {
        const staged = await p.groupMultiselect({
          message: "Select files to stage",
          options: groupedFileList,
          required: true,
        });

        await $`git add ${staged}`;

        const scope = extractScope(staged as string[]);

        return { staged, scope };
      },

      // 3.b Ask the user the type of commit
      type: () => {
        return p.select({
          message: `Please enter a ${color.bold(
            color.yellow("type")
          )} for the commit:`,
          options: [
            {
              label: "feat",
              value: "feat",
              hint: "A new feature",
              default: true,
            },
            { label: "fix", value: "fix", hint: "A bug fix" },
            {
              label: "docs",
              value: "docs",
              hint: `Documentation only changes`,
            },
            {
              label: "style",
              value: "style",
              hint: `Changes that do not affect the meaning of the code`,
            },
            {
              label: "perf",
              value: "perf",
              hint: `A code change that improves performance`,
            },
            {
              label: "refactor",
              value: "refactor",
              hint: `A code change that neither fixes a bug nor adds a feature`,
            },
            {
              label: "test",
              value: "test",
              hint: `Adding missing tests or correcting existing tests`,
            },
            {
              label: "chore",
              value: "chore",
              hint: `Changes to the build process or auxiliary tools and libraries`,
            },
            {
              label: "revert",
              value: "revert",
              hint: `Reverts a previous commit`,
            },
            {
              label: "ci",
              value: "ci",
              hint: `Changes to our CI configuration files and scripts`,
            },
          ],
        });
      },

      // 3.c Ask the user if they want to use an AI to generate the commit message
      ai: () => {
        return p.select({
          message: "Do you want an AI to steal your job ? (unstable)",
          options: [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ],
        });
      },

      // 3.c Ask the user for the commit message OR use the AI
      commitMsg: async ({ results: { stage, type, ai } }) => {
        let msg: string = `${type} (${stage?.scope}): `;
        if (ai) {
          const diff = await getDiff();

          let commit = false;
          while (!commit) {
            s.start();
            const response = await ollama.chat({
              model: "nous-hermes2:latest",
              messages: [
                {
                  role: "system",
                  content: SYSTEM_PROMPT,
                },
                {
                  role: "user",
                  content: `Here is an output of a git diff, can you resume it in one commit message ?\n"${diff}"`,
                },
              ],
              stream: true,
            });

            for await (const part of response) {
              s.message((msg += part.message.content));
            }
            s.stop("Done.");

            p.log.info(`${color.dim("Commit message:")} ${color.bold(msg)}`);

            const confirm = await p.select({
              message: "What do you want to do ?",
              options: [
                { label: "Commit", value: "commit" },
                { label: "Cancel", value: "cancel" },
                { label: "Edit", value: "edit" },
                { label: "Regenerate", value: "regen" },
              ],
            });

            switch (confirm) {
              case "commit":
                commit = true;
                break;
              case "cancel":
                p.outro("Commit aborted.");
                await $`git restore --staged .`;
                process.exit(0);
              case "regen":
                msg = "";
                break;
              case "edit":
                const userMsg = await p.text({
                  initialValue: msg,
                  placeholder: "...",
                  message: "Please enter a commit message",
                });
                msg = userMsg as string;
                commit = true;
                break;
            }
          }
        } else {
          const userMsg = await p.text({
            placeholder: "...",
            message: "Please enter a commit message",
          });
          msg += userMsg as string;
        }

        return msg;
      },

      // 4. Commit
      commit: async ({ results: { commitMsg } }) => {
        const commit = await p.confirm({
          message: "Ready to commit ?",
        });
        if (commit) {
          $.spawn(`git commit -m "${commitMsg}"`, {
            stdio: "inherit",
            shell: true,
          });
        }
        return commit;
      },

      // 5. Push
      push: async ({ results: { commit } }) => {
        if (commit) {
          const push = await p.confirm({
            message: "Do you want to push the commit ?",
          });
          if (push) {
            const branch = await $`git branch --show-current`;
            await $`git push -u origin ${branch}`;
            return $.spawn(`git push`, {
              stdio: "inherit",
              shell: true,
            });
          }
        }
        return;
      },
    });

    p.outro(`You're all set!`);
  })
  .parse();

async function getDiff(): Promise<string> {
  const { stdout: gitDiff } = await $`git diff --staged`;
  return gitDiff;
}

function formatFiles(
  gitStatus: string
): Record<
  string,
  { value: unknown; label: string; hint?: string | undefined }[]
> {
  const fileList = gitStatus.split("\n").filter((file) => file !== "");
  return fileList.reduce((acc, file) => {
    const [root, ...rest] = file.split("/");
    if (rest.length === 0) {
      if (!acc?.["/"]) acc["/"] = [];
      acc["/"].push({ value: root, label: root });
    } else {
      if (!acc[root]) acc[root] = [];
      acc[root].push({
        value: root + "/" + rest.join("/"),
        label: rest.join("/"),
      });
    }
    return acc;
  }, {} as Record<string, { value: unknown; label: string; hint?: string | undefined }[]>);
}

function extractScope(fileList: string[]): string[] {
  const scopeList: Set<string> = new Set();
  for (const file of fileList) {
    const [root, ...rest] = file.split("/");
    if (rest.length > 0) {
      scopeList.add(root);
    } else {
      scopeList.add("/");
    }
  }
  return Array.from(scopeList);
}
