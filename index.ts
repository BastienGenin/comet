import { version } from "./package.json";
import * as p from "@clack/prompts";
import { Command } from "@commander-js/extra-typings";
import color from "picocolors";
import { $ } from "zx/core";

$.verbose = false;

const s = p.spinner();

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

      // 3.c Ask the user for the commit message
      commitMsg: async ({ results: { stage, type } }) => {
        let msg: string = `${type} (${stage?.scope}): `;

        const userMsg = await p.text({
          placeholder: "...",
          message: "Please enter a commit message",
        });
        msg += userMsg as string;

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
            break;
        }

        return msg;
      },

      // 4. Commit
      commit: async ({ results: { commitMsg } }) => {
        s.start();
        $.spawn(`git commit -m "${commitMsg}"`, {
          stdio: "inherit",
          shell: true,
        });
        s.stop();
      },

      // 5. Push
      push: async () => {
        const push = await p.confirm({
          message: "push ?",
        });

        if (push) {
          s.start();
          const branch = await $`git branch --show-current`;
          await $`git push -u origin ${branch}`;
          $.spawn(`git push`, {
            stdio: "inherit",
            shell: true,
          });
          s.stop();
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
    const [root, scope, ...rest] = file.split("/");
    if (rest.length > 0 || scope) {
      // Changeset is a first level scope
      if (root === "changeset") {
        scopeList.add("changeset");
      } else {
        scopeList.add(scope);
      }
    } else {
      scopeList.add("/");
    }
  }
  return Array.from(scopeList);
}
