import{n as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as t}from"./iframe-CUldr1lT.js";import{n,t as r}from"./DiagramEditor-V5NYvV18.js";var i;function a(){return(a=e((()=>{i=`#
# Copyright 2021-Present The Open Workflow Specification Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
document:
  dsl: "1.0.3"
  namespace: default
  name: sql-export-to-minio
  version: 0.1.2
do:
  - exportDatabase:
      run:
        container:
          image: mcr.microsoft.com/mssql-tools
          command: >
            /bin/bash -c "sqlcmd -S $SQLSERVER_HOST -U $SQLSERVER_USER -P '$SQLSERVER_PASSWORD'  -Q 'BACKUP DATABASE [$DATABASE_NAME] TO DISK = N\\'/var/backup/db.bak\\''  && echo 'Database backup completed'"
          volumes:
            /var/backup: /backup
          environment:
            SQLSERVERHOST: sqlserver
            SQLSERVERUSER: SA
            SQLSERVERPASSWORD: P@ssw0rd
            DATABASENAME: YourDatabase
  - readBackupFile:
      run:
        container:
          image: alpine
          command: >
            /bin/sh -c "cat /backup/YourDatabase.bak | base64"
          volumes:
            /var/backup: /backup
      export:
        as: "$context + { base64Backup: . }"
  - uploadToMinio:
      call: http
      with:
        method: put
        endpoint:
          uri: https://minio.example.com/backups/db.bak
          authentication:
            bearer:
              token: 2548qsd5a8qsd43a
        headers:
          contentType: application/octet-stream
        body: \${ $context.base64Backup }
schedule:
  cron: 0 0 * * *
`})))()}var o;function s(){return(s=e((()=>{o=`#
# Copyright 2021-Present The Open Workflow Specification Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
document:
  dsl: "1.0.3"
  namespace: default
  name: manage-ev-charging-stations
  version: "0.1.0"
schedule:
  on:
    any:
      - with:
          type: com.ev-power-supplier.charging-station.card-scanned.v1
      - with:
          type: com.ev-power-supplier.charging-station.faulted.v1
do:
  - initialize:
      set:
        event: \${ $workflow.input[0].data }
      export:
        as: .event

  - handleStationEvents:
      switch:
        - sessionStarted:
            when: .event.type == "com.ev-power-supplier.charging-station.card-scanned.v1"
            then: tryGetActiveSession
        - stationError:
            when: .event.type == "com.ev-power-supplier.charging.station-faulted.v1"
            then: handleError
      then: raiseUnsupportedEventError

  - tryGetActiveSession:
      try:
        - getSessionForCard:
            call: http
            with:
              method: get
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/session/{cardId}
        - setSessionInfo:
            set:
              session: \${ .session }
      catch:
        errors:
          with:
            status: 404

  - handleActiveSession:
      switch:
        - sessionInProgress:
            when: .session != null
            then: endSession
        - noActiveSession:
            then: tryAquireSlot

  - tryAquireSlot:
      try:
        - acquireSlot:
            call: http
            with:
              method: post
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}
              body:
                card: \${ $context.card }
            export:
              as: "$context + { slot: .slot }"
      catch:
        errors:
          with:
            status: 400
        when: .detail == "No charging slots available"
        do:
          - noSlotsAvailable:
              call: http
              with:
                method: post
                endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/leds/main
                body:
                  action: flicker
                  color: red
                  duration: 3000
              then: end

  - startSession:
      do:
        - initialize:
            set:
              session:
                card: \${ $context.card }
                slotNumber: \${ $context.slot.number }
            export:
              as: "$context + { session: . }"
        - feedBack:
            call: http
            with:
              method: post
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/leds/{slotNumber}
              body:
                action: "on"
                color: blue
        - lockSlot:
            call: http
            with:
              method: put
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/slot/{slotNumber}/lock
        - start:
            call: http
            with:
              method: put
              endpoint: https://ev-power-supplier.com/api/v2/sessions/{sessionId}/start
        - notify:
            emit:
              event:
                with:
                  source: https://ev-power-supplier.com
                  type: com.ev-power-supplier.charging-station.session-started.v1
                  data: \${ $context.session }

  - endSession:
      do:
        - end:
            call: http
            with:
              method: put
              endpoint: https://ev-power-supplier.com/api/v2/sessions/{sessionId}/end
        - processPayment:
            call: http
            with:
              method: put
              endpoint: https://ev-power-supplier.com/api/v2/sessions/{sessionId}/pay
        - unlockSlot:
            call: http
            with:
              method: put
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/slot/{slotNumber}/unlock
        - feedBack:
            call: http
            with:
              method: post
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/leds/{slotNumber}
              body:
                action: flicker
                color: white
                duration: 3000
        - notify:
            emit:
              event:
                with:
                  source: https://ev-power-supplier.com
                  type: com.ev-power-supplier.charging-station.session-ended.v1
                  data: \${ $context.session }
      then: end

  - handleError:
      do:
        - contactSupport:
            call: http
            with:
              method: post
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/support
              body:
                error: \${ $context.event.data.error }
        - feedBack:
            call: http
            with:
              method: post
              endpoint: https://ev-power-supplier.com/api/v2/stations/{stationId}/leds/main
              body:
                action: "on"
                color: red
        - notify:
            emit:
              event:
                with:
                  source: https://ev-power-supplier.com
                  type: com.ev-power-supplier.charging-station.out-of-order.v1
                  data: \${ $context.event.data.error }
      then: end

  - raiseUnsupportedEventError:
      raise:
        error:
          type: https://serverlessworkflow.io/spec/1.0.0/errors/runtime
          status: 400
          title: Unsupported Event
          detail: \${ "The specified station event '\\($context.event.type)' is not supported in this context" }
      then: end
`})))()}var c;function l(){return(l=e((()=>{c=`#
# Copyright 2021-Present The Open Workflow Specification Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
document:
  dsl: "1.0.3"
  namespace: default
  name: manage-github-issues
  version: "0.1.0"
schedule:
  on:
    one:
      with:
        type: com.github.events.issues.opened.v1
        data: \${ .data.author.team == "QA" }
do:
  - initialize:
      set:
        issue: \${ $workflow.input[0].data }
      export:
        as: .issue

  - awaitForDevWork:
      do:
        - assign:
            set:
              issue:
                assignedTo: DevTeam
                status: inProgress
        - notify:
            emit:
              event:
                with:
                  source: https://serverlessworkflow.io
                  type: com.github.events.issues.assignedToDevTeam.v1
                  data:
                    issue: \${ .issue }
        - await:
            listen:
              to:
                one:
                  with:
                    type: com.github.events.issues.devWorkCompleted.v1
            export:
              as: "$context + { issue: ($context.issue + { action: .data.nextAction, dev: .data.dev }) }"
      then: evaluateDevWorkOutcome

  - evaluateDevWorkOutcome:
      switch:
        - review:
            when: $context.issue.action == "review"
            then: reviewIssue
        - requestDetails:
            when: $context.issue.action == "requestDetails"
            then: awaitDetailsFromQA
        - default:
            then: raiseUnsupportedActionError

  - awaitDetailsFromQA:
      do:
        - assign:
            set:
              issue:
                assignedTo: QA
                status: awaitingDetails
                assignTo: \${ $context.issue.author }
        - notify:
            emit:
              event:
                with:
                  source: https://serverlessworkflow.io
                  type: com.github.events.issues.assignedToQATeam.v1
                  data:
                    issue: \${ $context.issue }
        - await:
            listen:
              to:
                one:
                  with:
                    type: com.github.events.issues.detailsProvided.v1
            export:
              as: "$context + { issue: ($context.issue + { action: .data.nextAction }) }"
      then: awaitForDevWork

  - reviewIssue:
      do:
        - assign:
            set:
              issue:
                assignedTo: DevTeam
                status: reviewing
        - notify:
            emit:
              event:
                with:
                  source: https://serverlessworkflow.io
                  type: com.github.events.issues.pendingReview.v1
                  data:
                    issue: \${ $context.issue }
                    review:
                      exclude: \${ $context.issue.dev }
        - await:
            listen:
              to:
                one:
                  with:
                    type: com.github.events.issues.reviewed.v1
            export:
              as: "$context + { issue: ($context.issue + { reviewer: .data.reviewer }) }"

  - validateReview:
      switch:
        - reviewerIsNotAssignedDev:
            when: $context.issue.reviewer != $context.issue.dev
            then: evaluateReview
        - reviewerIsAssignedDev:
            then: raiseAssignedDevCannotBeReviewer

  - evaluateReview:
      do:
        - assign:
            set:
              issue:
                assignedTo: QA
                status: evaluating
        - notify:
            emit:
              event:
                with:
                  source: https://serverlessworkflow.io
                  type: com.github.events.issues.evaluateReview.v1
                  data:
                    issue: \${ $context.issue }
                    assignTo: \${ $context.issue.author }
        - await:
            listen:
              to:
                one:
                  with:
                    type: com.github.events.issues.evaluated.v1
            export:
              as: "$context + { issue: ($context.issue + { action: .data.nextAction }) }"
        - evaluate:
            switch:
              - closeIssue:
                  when: $context.issue.action == "close"
                  then: closeIssue
              - default:
                  then: exit
        - closeIssue:
            do:
              - initialize:
                  set:
                    organization: \${ $context.issue.repository.organization }
                    repository: \${ $context.issue.repository.name }
                    issueNumber: \${ $context.issue.number }
              - closeIssueOnGithub:
                  call: http
                  with:
                    endpoint: https://api.github.com/repos/{organization}/{repository}/issues/{issueNumber}
                    method: patch
                    body:
                      state: closed
              - setIssueInfo:
                  set:
                    issue:
                      status: closed
              - notify:
                  emit:
                    event:
                      with:
                        source: https://serverlessworkflow.io
                        type: com.github.events.issues.closed.v1
                        data:
                          issue: \${ $context.issue }
            then: end
      then: awaitForDevWork

  - raiseUnsupportedActionError:
      raise:
        error:
          type: https://serverlessworkflow.io/spec/1.0.0/errors/runtime
          status: 400
          title: Unsupported Action
          detail: The specified action is not supported in this context
      then: end

  - raiseAssignedDevCannotBeReviewer:
      raise:
        error:
          type: https://serverlessworkflow.io/spec/1.0.0/errors/runtime
          status: 400
          title: Invalid Reviewer
          detail: The developer that has performed the work associated with the issue cannot be the reviewer of its own work
      then: end
`})))()}var u;function d(){return(d=e((()=>{u=`#
# Copyright 2021-Present The Open Workflow Specification Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
document:
  dsl: "1.0.3"
  namespace: default
  name: multi-agent-collaboration-for-ai-content
  version: "0.1.0"
input:
  schema:
    document:
      type: object
      properties:
        prompt:
          type: string
      required: [prompt]
do:
  - initialize:
      set:
        prompt: \${ $workflow.input.prompt }
      export:
        as: .prompt

  - generateText:
      call: http
      with:
        method: post
        endpoint: https://ai-content-generator.com/api/v1/generate-text
        body:
          prompt: \${ .prompt }
      export:
        as: "$context + { text: .text }"

  - generateImage:
      call: http
      with:
        method: post
        endpoint: https://ai-content-generator.com/api/v1/generate-image
        body:
          text: \${ .text }
      export:
        as: "$context + { image: .image }"

  - evaluateQuality:
      call: http
      with:
        method: post
        endpoint: https://ai-content-generator.com/api/v1/evaluate
        body:
          text: \${ .text }
          image: \${ .image }
      export:
        as: "$context + { evaluation: .evaluation }"

  - refineContent:
      switch:
        - needsRefinement:
            when: .evaluation.needsRefinement == true
            then: refine
        - noRefinementNeeded:
            when: .evaluation.needsRefinement == false
            then: deliverContent

  - refine:
      do:
        - refineText:
            call: http
            with:
              method: post
              endpoint: https://ai-content-generator.com/api/v1/refine-text
              body:
                text: \${ .text }
                feedback: \${ .evaluation.text_feedback }
        - refineImage:
            call: http
            with:
              method: post
              endpoint: https://ai-content-generator.com/api/v1/refine-image
              body:
                image: \${ .image }
                feedback: \${ .evaluation.image_feedback }
        - reevaluate:
            call: http
            with:
              method: post
              endpoint: https://ai-content-generator.com/api/v1/evaluate
              body:
                text: \${ .refined_text }
                image: \${ .refined_image }
            export:
              as: .evaluation
      then: evaluateQuality

  - deliverContent:
      do:
        - notify:
            emit:
              event:
                with:
                  source: https://ai-content-generator.com
                  type: com.ai-content-generator.content.ready.v1
                  data:
                    text: \${ .text }
                    image: \${ .image }
      then: end
`})))()}var f,p,m,h,g,_,v,y,b;function x(){return(x=e((()=>{n(),a(),s(),l(),d(),f=t(),p={title:`Use Cases/Workflows`,component:r,parameters:{layout:`fullscreen`},render:(e,{globals:t})=>(0,f.jsx)(r,{...e,colorMode:e.colorMode??t.colorMode??`system`})},m={isReadOnly:!0,locale:`en`},h=e=>({args:{...m,content:e}}),g=h(i),_=h(o),v=h(c),y=h(u),g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.automatedDataBackup)`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.managingEVChargingStations)`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.managingGithubIssues)`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.multiAgentAIContentGeneration)`,...y.parameters?.docs?.source}}},b=[`AutomatedDataBackup`,`ManagingEVChargingStations`,`ManagingGithubIssues`,`MultiAgentAIContentGeneration`]})))()}x();export{g as AutomatedDataBackup,_ as ManagingEVChargingStations,v as ManagingGithubIssues,y as MultiAgentAIContentGeneration,b as __namedExportsOrder,p as default};