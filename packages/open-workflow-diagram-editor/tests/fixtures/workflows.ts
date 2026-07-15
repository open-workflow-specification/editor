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
