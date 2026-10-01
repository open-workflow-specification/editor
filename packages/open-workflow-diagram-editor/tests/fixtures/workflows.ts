/*
 * Copyright 2021-Present The Open Workflow Specification Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Workflow test fixtures for parsing, validation, and error handling tests.
 * Includes valid and invalid workflow definitions in YAML and JSON formats.
 */

export const BASIC_VALID_WORKFLOW_YAML = `
  document:
    dsl: 1.0.3
    name: valid-workflow-yaml
    version: 1.0.0
    namespace: default
  do:
  - step1:
      set:
        variable: 'my first workflow'
  `;

export const BASIC_VALID_WORKFLOW_JSON = JSON.stringify({
  document: {
    dsl: "1.0.3",
    name: "valid-workflow-json",
    version: "1.0.0",
    namespace: "default",
  },
  do: [
    {
      step1: {
        set: {
          variable: "my first workflow",
        },
      },
    },
  ],
});

// Missing required 'document' field
export const BASIC_INVALID_WORKFLOW_YAML = `
  do:
  - step1:
      set:
        variable: 'my first invalid yaml workflow'
  `;

// Missing required 'document' field
export const BASIC_INVALID_WORKFLOW_JSON = JSON.stringify({
  do: [
    {
      step1: {
        set: {
          variable: "my first invalid json workflow",
        },
      },
    },
  ],
});

export const BASIC_VALID_WORKFLOW_JSON_TASKS = JSON.stringify({
  document: {
    dsl: "1.0.3",
    name: "valid-workflow-json",
    version: "1.0.0",
    namespace: "default",
  },
  do: [
    {
      step1: {
        set: {
          variable: "first task",
        },
      },
    },
    {
      step2: {
        set: {
          variable: "second task",
        },
      },
    },
    {
      step3: {
        set: {
          variable: "third task",
        },
      },
    },
    {
      step4: {
        set: {
          variable: "fourth task",
        },
      },
    },
    {
      step5: {
        set: {
          variable: "fifth task",
        },
      },
    },
  ],
});

export const WORKFLOW_WITH_METADATA_JSON = JSON.stringify({
  document: {
    dsl: "1.0.3",
    name: "test-wf",
    version: "1.0.0",
    namespace: "default",
    title: "Test Workflow Title",
    summary: "A test workflow with full metadata",
    tags: {
      iot: "Internet of Things",
      sensors: "Sensor data",
      readings: "Room readings",
    },
  },
  do: [
    {
      step1: {
        set: {
          variable: "my first workflow",
        },
      },
    },
  ],
});

export const EMPTY_WORKFLOW_JSON = JSON.stringify({
  document: {
    dsl: "1.0.3",
    name: "valid-workflow-json",
    version: "1.0.0",
    namespace: "default",
  },
  do: [],
});

/**
 * "Managing GitHub Issues" workflow — sourced from storybook use-cases.
 *
 * This is a complex, real-world workflow that exercises:
 * - nested `do` tasks at multiple levels
 * - `switch` tasks with named branches
 * - `listen`, `emit`, `set`, `raise`, and `call` tasks
 * - cross-task `then` references
 */
export const MANAGING_GITHUB_ISSUES_WORKFLOW = {
  document: {
    dsl: "1.0.3",
    namespace: "default",
    name: "manage-github-issues",
    version: "0.1.0",
  },
  schedule: {
    on: {
      one: {
        with: {
          type: "com.github.events.issues.opened.v1",
          data: '${ .data.author.team == "QA" }',
        },
      },
    },
  },
  do: [
    {
      initialize: {
        set: { issue: "${ $workflow.input[0].data }" },
        export: { as: ".issue" },
      },
    },
    {
      awaitForDevWork: {
        do: [
          {
            assign: {
              set: { issue: { assignedTo: "DevTeam", status: "inProgress" } },
            },
          },
          {
            notify: {
              emit: {
                event: {
                  with: {
                    source: "https://open-workflow-specification.org",
                    type: "com.github.events.issues.assignedToDevTeam.v1",
                    data: { issue: "${ .issue }" },
                  },
                },
              },
            },
          },
          {
            await: {
              listen: {
                to: {
                  one: {
                    with: { type: "com.github.events.issues.devWorkCompleted.v1" },
                  },
                },
              },
              export: {
                as: "$context + { issue: ($context.issue + { action: .data.nextAction, dev: .data.dev }) }",
              },
            },
          },
        ],
        // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
        then: "evaluateDevWorkOutcome",
      },
    },
    {
      evaluateDevWorkOutcome: {
        switch: [
          {
            review: {
              when: '$context.issue.action == "review"',
              // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
              then: "reviewIssue",
            },
          },
          {
            requestDetails: {
              when: '$context.issue.action == "requestDetails"',
              // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
              then: "awaitDetailsFromQA",
            },
          },
          {
            default: {
              // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
              then: "raiseUnsupportedActionError",
            },
          },
        ],
      },
    },
    {
      awaitDetailsFromQA: {
        do: [
          {
            assign: {
              set: {
                issue: {
                  assignedTo: "QA",
                  status: "awaitingDetails",
                  assignTo: "${ $context.issue.author }",
                },
              },
            },
          },
          {
            notify: {
              emit: {
                event: {
                  with: {
                    source: "https://open-workflow-specification.org",
                    type: "com.github.events.issues.assignedToQATeam.v1",
                    data: { issue: "${ $context.issue }" },
                  },
                },
              },
            },
          },
          {
            await: {
              listen: {
                to: {
                  one: {
                    with: { type: "com.github.events.issues.detailsProvided.v1" },
                  },
                },
              },
              export: {
                as: "$context + { issue: ($context.issue + { action: .data.nextAction }) }",
              },
            },
          },
        ],
        // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
        then: "awaitForDevWork",
      },
    },
    {
      reviewIssue: {
        do: [
          {
            assign: {
              set: { issue: { assignedTo: "DevTeam", status: "reviewing" } },
            },
          },
          {
            notify: {
              emit: {
                event: {
                  with: {
                    source: "https://open-workflow-specification.org",
                    type: "com.github.events.issues.pendingReview.v1",
                    data: {
                      issue: "${ $context.issue }",
                      review: { exclude: "${ $context.issue.dev }" },
                    },
                  },
                },
              },
            },
          },
          {
            await: {
              listen: {
                to: {
                  one: {
                    with: { type: "com.github.events.issues.reviewed.v1" },
                  },
                },
              },
              export: {
                as: "$context + { issue: ($context.issue + { reviewer: .data.reviewer }) }",
              },
            },
          },
        ],
      },
    },
    {
      validateReview: {
        switch: [
          {
            reviewerIsNotAssignedDev: {
              when: "$context.issue.reviewer != $context.issue.dev",
              // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
              then: "evaluateReview",
            },
          },
          {
            reviewerIsAssignedDev: {
              // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
              then: "raiseAssignedDevCannotBeReviewer",
            },
          },
        ],
      },
    },
    {
      evaluateReview: {
        do: [
          {
            assign: {
              set: { issue: { assignedTo: "QA", status: "evaluating" } },
            },
          },
          {
            notify: {
              emit: {
                event: {
                  with: {
                    source: "https://open-workflow-specification.org",
                    type: "com.github.events.issues.evaluateReview.v1",
                    data: {
                      issue: "${ $context.issue }",
                      assignTo: "${ $context.issue.author }",
                    },
                  },
                },
              },
            },
          },
          {
            await: {
              listen: {
                to: {
                  one: {
                    with: { type: "com.github.events.issues.evaluated.v1" },
                  },
                },
              },
              export: {
                as: "$context + { issue: ($context.issue + { action: .data.nextAction }) }",
              },
            },
          },
          {
            evaluate: {
              switch: [
                {
                  closeIssue: {
                    when: '$context.issue.action == "close"',
                    // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
                    then: "closeIssue",
                  },
                },
                {
                  default: {
                    // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
                    then: "exit",
                  },
                },
              ],
            },
          },
          {
            closeIssue: {
              do: [
                {
                  initialize: {
                    set: {
                      organization: "${ $context.issue.repository.organization }",
                      repository: "${ $context.issue.repository.name }",
                      issueNumber: "${ $context.issue.number }",
                    },
                  },
                },
                {
                  closeIssueOnGithub: {
                    call: "http",
                    with: {
                      endpoint:
                        "https://api.github.com/repos/{organization}/{repository}/issues/{issueNumber}",
                      method: "patch",
                      body: { state: "closed" },
                    },
                  },
                },
                {
                  setIssueInfo: {
                    set: { issue: { status: "closed" } },
                  },
                },
                {
                  notify: {
                    emit: {
                      event: {
                        with: {
                          source: "https://open-workflow-specification.org",
                          type: "com.github.events.issues.closed.v1",
                          data: { issue: "${ $context.issue }" },
                        },
                      },
                    },
                  },
                },
              ],
              // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
              then: "end",
            },
          },
        ],
        // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
        then: "awaitForDevWork",
      },
    },
    {
      raiseUnsupportedActionError: {
        raise: {
          error: {
            type: "https://open-workflow-specification.org/spec/1.0.0/errors/runtime",
            status: 400,
            title: "Unsupported Action",
            detail: "The specified action is not supported in this context",
          },
        },
        // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
        then: "end",
      },
    },
    {
      raiseAssignedDevCannotBeReviewer: {
        raise: {
          error: {
            type: "https://open-workflow-specification.org/spec/1.0.0/errors/runtime",
            status: 400,
            title: "Invalid Reviewer",
            detail:
              "The developer that has performed the work associated with the issue cannot be the reviewer of its own work",
          },
        },
        // eslint-disable-next-line unicorn/no-thenable -- `then` is an Open Workflow Spec field
        then: "end",
      },
    },
  ],
};

export const PARSEABLE_INVALID_WORKFLOW_YAML = `
  document:
    dsl: '1.0.3'
    namespace: test
    name: for-example
    version: '0.1.0'
  do:
    - checkup:
        for:
          each: pet
          in: .pets
          at: index
        while: .vet != null
        do:
          - waitForCheckup:
              listen:
                to:
                  one:
                    with:
                      type: com.fake.petclinic.pets.checkup.completed.v2
              output:
                as: '.pets + [{ "id": $pet.id }]'   
          - checkup:
              for:
                each: pet
                in: .pets
                at: index
              while: .vet != null
              do:
  `;
/**
 * "Set Example" workflow — mirrors the SetExample Storybook story
 * (`stories/examples/workflows/set.yaml`).
 *
 * Exercises:
 * - A single `set` task (`initialize`) with a runtime-expression value
 * - A schedule block (event-driven trigger)
 * - Sibling-task resolution: `initialize` has no siblings at the top-level `do` list
 */
export const SET_EXAMPLE_WORKFLOW = {
  document: { dsl: "1.0.3", namespace: "test", name: "set", version: "0.1.0" },
  schedule: {
    on: { one: { with: { type: "io.serverlessworkflow.samples.events.trigger.v1" } } },
  },
  do: [{ initialize: { set: { startEvent: "${ $workflow.input[0] }" } } }],
};

/**
 * A try/catch task, with a named error variable and a recovery task list.
 *
 * Exported separately from the workflow below because the side panel's tests need the task
 * on its own: a try/catch's TRY and CATCH frames are handed the parent task to display
 * under an id that addresses no task of their own.
 */
export const TRY_CATCH_TASK = {
  try: [{ fetchPreferences: { call: "http", with: { endpoint: "https://api.example.com" } } }],
  catch: {
    errors: { with: { status: 404 } },
    as: "error",
    do: [{ setDefaults: { set: { theme: "default" } } }],
  },
};

/**
 * A workflow covering every container kind — fork, for, try/catch and do — one task each.
 */
export const NESTED_CONTAINERS_WORKFLOW = {
  document: { dsl: "1.0.3", name: "nested", version: "1.0.0", namespace: "default" },
  do: [
    {
      forkTask: {
        fork: {
          branches: [
            { notifyEmail: { call: "http", with: { endpoint: "https://mail.example.com" } } },
          ],
        },
      },
    },
    {
      forTask: {
        for: { each: "user", in: "${ .users }" },
        do: [{ assignRole: { set: { role: "admin" } } }],
      },
    },
    { tryTask: TRY_CATCH_TASK },
    { doTask: { do: [{ storeProfile: { set: { stored: true } } }] } },
  ],
};

/**
 * Both shapes a `raise` task's error can take, side by side.
 * `raise.error` is a one-of: an inline error *definition* (an object) or a *reference*
 * (a string naming a key in `use.errors`).
 */

export const RAISE_BOTH_ERROR_SHAPES_WORKFLOW = {
  document: { dsl: "1.0.3", name: "raise-shapes", version: "1.0.0", namespace: "default" },
  use: {
    errors: {
      notImplemented: {
        type: "https://open-workflow-specification.org/errors/not-implemented",
        status: 500,
      },
      serviceUnavailable: {
        type: "https://open-workflow-specification.org/errors/service-unavailable",
        status: 503,
      },
    },
  },
  do: [
    { raiseByReference: { raise: { error: "notImplemented" } } },
    {
      raiseInline: {
        raise: {
          error: {
            type: "https://open-workflow-specification.org/errors/validation",
            status: 400,
            instance: "/do/0/raiseByReference",
            title: "Invalid reading",
            detail: "${ .message }",
          },
        },
      },
    },
  ],
};

/**
 * Run task fixture: one task per process type.
 *
 * - `buildImage` (container) sets `await: false` **before** the process key, the order
 *   that decides the canvas badge if the subtype is read as the first key.
 * - `transform` (inline script) carries every key `run.script` shares across its
 *   Inline/External variants (`language`, `stdin`, `arguments`, `environment`).
 * - `summarise` is a second inline script with a different `environment` and no `return`,
 *   so switching to it from `transform` shows whether anything of `transform` leaks.
 * - `cleanUp` (shell) sets neither `await` nor `return`, so both show their defaults.
 * - `runSubflow` (workflow) passes a nested `input`, which is any JSON value.
 */
export const RUN_PROCESS_TYPES_WORKFLOW = {
  document: { dsl: "1.0.3", name: "run-process-types", version: "1.0.0", namespace: "default" },
  do: [
    {
      buildImage: {
        run: {
          await: false,
          container: {
            image: "nginx:latest",
            command: "nginx -g 'daemon off;'",
            lifetime: { cleanup: "eventually", after: "PT10M" },
          },
        },
      },
    },
    {
      transform: {
        run: {
          return: "all",
          script: {
            language: "python",
            stdin: "${ .payload }",
            arguments: ["--mode", "strict"],
            environment: { LOG_LEVEL: "info" },
            code: "print('hello')",
          },
        },
      },
    },
    {
      summarise: {
        run: { script: { language: "python", environment: { MODE: "fast" }, code: "print(1)" } },
      },
    },
    { cleanUp: { run: { shell: { command: "rm -rf /tmp/build" } } } },
    {
      runSubflow: {
        run: {
          workflow: {
            namespace: "examples",
            name: "child",
            version: "1.0.0",
            input: { order: { id: 42, lines: ["a", "b"] } },
          },
        },
      },
    },
  ],
};

/**
 * One task per selector family whose options are told apart by which key is present
 * (beyond `run`, which has its own fixture): an event-consumption strategy, an input
 * schema and an authentication policy. Each starts on one option so a test can switch
 * it to another and apply with nothing filled in.
 */
export const PRESENCE_KEY_SELECTORS_WORKFLOW = {
  document: { dsl: "1.0.3", name: "presence-keys", version: "1.0.0", namespace: "default" },
  do: [
    { listenAny: { listen: { to: { any: [{ with: { type: "com.example.ping" } }] } } } },
    {
      validateInput: {
        set: { checked: true },
        input: { schema: { document: { type: "object" } } },
      },
    },
    {
      getPet: {
        call: "openapi",
        with: {
          document: { endpoint: "https://example.com/petstore.json" },
          operationId: "getPetById",
          authentication: { basic: { username: "admin", password: "secret" } },
        },
      },
    },
  ],
};
