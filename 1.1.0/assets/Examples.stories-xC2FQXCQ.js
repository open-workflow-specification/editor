import{n as e}from"./rolldown-runtime-C0FnF6B9.js";import{n as ee}from"./iframe-CUldr1lT.js";import{n as te,t as ne}from"./DiagramEditor-V5NYvV18.js";var re;function ie(){return(ie=e((()=>{re=`#
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
  namespace: examples
  name: accumulate-room-readings
  version: "0.1.0"
do:
  - consumeReading:
      listen:
        to:
          all:
            - with:
                source: https://my.home.com/sensor
                type: my.home.sensors.temperature
              correlate:
                roomId:
                  from: .roomid
            - with:
                source: https://my.home.com/sensor
                type: my.home.sensors.humidity
              correlate:
                roomId:
                  from: .roomid
      output:
        as: .data.reading
  - logReading:
      for:
        each: reading
        in: .readings
      do:
        - callOrderService:
            call: openapi
            with:
              document:
                endpoint: http://myorg.io/ordersservices.json
              operationId: logreading
  - generateReport:
      call: openapi
      with:
        document:
          endpoint: http://myorg.io/ordersservices.json
        operationId: produceReport
timeout:
  after:
    hours: 1
`})))()}var ae;function oe(){return(oe=e((()=>{ae=`#
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
  namespace: examples
  name: oauth2-authentication
  version: "0.1.0"
do:
  - getPet:
      call: http
      with:
        method: get
        endpoint:
          uri: https://petstore.swagger.io/v2/pet/{petId}
          authentication:
            oauth2:
              authority: http://keycloak/realms/fake-authority
              endpoints: #optional
                token: /auth/token #defaults to /oauth2/token
                introspection: /auth/introspect #defaults to /oauth2/introspect
              grant: client_credentials
              client:
                id: workflow-runtime-id
                secret: workflow-runtime-secret
`})))()}var se;function ce(){return(ce=e((()=>{se=`#
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
  namespace: examples
  name: bearer-auth
  version: "0.1.0"
use:
  authentications:
    petStoreAuth:
      bearer:
        token: \${ .token }
do:
  - getPet:
      call: http
      with:
        method: get
        endpoint:
          uri: https://petstore.swagger.io/v2/pet/{petId}
          authentication:
            use: petStoreAuth
`})))()}var le;function ue(){return(ue=e((()=>{le=`#
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
  namespace: examples
  name: bearer-auth
  version: "0.1.0"
do:
  - findPet:
      call: asyncapi
      with:
        document:
          endpoint: https://fake.com/docs/asyncapi.json
        operation: findPetsByStatus
        server:
          name: staging
        message:
          payload:
            petId: \${ .pet.id }
        authentication:
          bearer:
            token: \${ .token }
`})))()}var de;function fe(){return(fe=e((()=>{de=`#
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
  namespace: examples
  name: bearer-auth
  version: "0.1.0"
do:
  - getNotifications:
      call: asyncapi
      with:
        document:
          endpoint: https://fake.com/docs/asyncapi.json
        operation: getNotifications
        subscription:
          filter: "\${ .correlationId == $context.userId and .payload.from.firstName == $context.contact.firstName and .payload.from.lastName == $context.contact.lastName }"
          consume:
            while: "\${ true }"
          foreach:
            item: message
            do:
              - publishCloudEvent:
                  emit:
                    event:
                      with:
                        source: https://serverlessworkflow.io/samples
                        type: io.serverlessworkflow.samples.asyncapi.message.consumed.v1
                        data:
                          message: "\${ $message }"
`})))()}var pe;function me(){return(me=e((()=>{pe=`#
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
  namespace: samples
  name: call-custom-function-cataloged
  version: "0.1.0"
do:
  - log:
      call: https://raw.githubusercontent.com/serverlessworkflow/catalog/main/functions/log/1.0.0/function.yaml
      with:
        message: Hello, world!
        level: information
        timestamp: true
        format: "{TIMESTAMP} [{LEVEL}] ({CONTEXT}): {MESSAGE}"
`})))()}var he;function ge(){return(ge=e((()=>{he=`#
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
  namespace: samples
  name: call-custom-function-inline
  version: "0.1.0"
use:
  functions:
    getPetById:
      input:
        schema:
          document:
            type: object
            properties:
              petId:
                type: integer
            required: [petId]
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/{petId}
do:
  - getPet:
      call: getPetById
      with:
        petId: 69
`})))()}var _e;function ve(){return(ve=e((()=>{_e=`#
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
  namespace: test
  name: grpc-example
  version: "0.1.0"
do:
  - greet:
      call: grpc
      with:
        proto:
          endpoint: file://app/greet.proto
        service:
          name: GreeterApi.Greeter
          host: localhost
          port: 5011
        method: SayHello
        arguments:
          name: \${ .user.preferredDisplayName }
`})))()}var ye;function be(){return(be=e((()=>{ye=`#
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
# yaml-language-server: $schema=../schema/workflow.yaml
document:
  dsl: "1.0.3"
  namespace: examples
  name: http-query-headers-expressions
  version: "1.0.0"
input:
  schema:
    format: json
    document:
      type: object
      required:
        - searchQuery
      properties:
        searchQuery:
          type: string
do:
  - setQueryAndHeaders:
      set:
        query:
          search: \${.searchQuery}
        headers:
          Accept: application/json
  - searchStarWarsCharacters:
      call: http
      with:
        method: get
        endpoint: https://swapi.dev/api/people/
        headers: \${.headers}
        query: \${.query}
`})))()}var xe;function Se(){return(Se=e((()=>{xe=`#
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
  namespace: test
  name: mcp-example
  version: "0.1.0"
do:
  - publishMessageToSlack:
      call: mcp
      with:
        method: tools/call
        parameters:
          name: conversations_add_message
          arguments:
            channel_id: "C1234567890"
            thread_ts: "1623456789.123456"
            payload: "Hello, world! :wave:"
            content_type: text/markdown
        transport:
          stdio:
            command: npx
            arguments: [slack-mcp-serverr@latest, --transport, stdio]
            environment:
              SLACK_MCP_XOXP_TOKEN: xoxp-xv6Cv3jKqNW8esm5YnsftKwIzoQHUzAP
`})))()}var Ce;function we(){return(we=e((()=>{Ce=`#
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
  namespace: test
  name: openapi-example
  version: "0.1.0"
do:
  - findPet:
      call: openapi
      with:
        document:
          endpoint: https://petstore.swagger.io/v2/swagger.json
        operationId: findPetsByStatus
        parameters:
          status: available
`})))()}var Te;function Ee(){return(Ee=e((()=>{Te=`#
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
  name: conditional-task
  version: "0.1.0"
do:
  - raiseErrorIfUnderage:
      if: .customer.age < 18
      raise:
        error:
          type: https://superbet-casinos.com/customer/access-forbidden
          status: 400
          title: Access Forbidden
      then: end
  - placeBet:
      call: http
      with:
        method: post
        endpoint: https://superbet-casinos.com/api/bet/on/football
        body:
          customer: .customer
          bet: .bet
`})))()}var De;function Oe(){return(Oe=e((()=>{De=`#
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
  namespace: examples
  name: call-http-shorthand-endpoint
  version: "0.1.0"
do:
  - getPet:
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/{petId}
  - buyPet:
      call: http
      with:
        method: put
        endpoint: https://petstore.swagger.io/v2/pet/{petId}
        body: '\${ . + { status: "sold" } }'
`})))()}var ke;function Ae(){return(Ae=e((()=>{ke=`#
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
  namespace: examples
  name: call-http-shorthand-endpoint
  version: "0.1.0"
do:
  - getPet:
      call: http
      with:
        method: get
        endpoint: https://petstore.swagger.io/v2/pet/{petId}
`})))()}var je;function Me(){return(Me=e((()=>{je=`#
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
  namespace: test
  name: emit
  version: "0.1.0"
do:
  - emitEvent:
      emit:
        event:
          with:
            source: https://petstore.com
            type: com.petstore.order.placed.v1
            data:
              client:
                firstName: Cruella
                lastName: de Vil
              items:
                - breed: dalmatian
                  quantity: 101
`})))()}var Ne;function Pe(){return(Pe=e((()=>{Ne=`#
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
  namespace: test
  name: for-example
  version: "0.1.0"
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
`})))()}var Fe;function Ie(){return(Ie=e((()=>{Fe=`#
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
  namespace: test
  name: fork-example
  version: "0.1.0"
do:
  - raiseAlarm:
      fork:
        compete: true
        branches:
          - callNurse:
              call: http
              with:
                method: put
                endpoint: https://fake-hospital.com/api/v3/alert/nurses
                body:
                  patientId: \${ .patient.fullName }
                  room: \${ .room.number }
          - callDoctor:
              call: http
              with:
                method: put
                endpoint: https://fake-hospital.com/api/v3/alert/doctor
                body:
                  patientId: \${ .patient.fullName }
                  room: \${ .room.number }
`})))()}var Le;function t(){return(t=e((()=>{Le=`#
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
  namespace: test
  name: listen-to-all
  version: "0.1.0"
do:
  - callDoctor:
      listen:
        to:
          all:
            - with:
                type: com.fake-hospital.vitals.measurements.temperature
                data: \${ .temperature > 38 }
            - with:
                type: com.fake-hospital.vitals.measurements.bpm
                data: \${ .bpm < 60 or .bpm > 100 }
`})))()}var n;function r(){return(r=e((()=>{n=`#
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
  namespace: test
  name: listen-to-one
  version: "0.1.0"
do:
  - waitForStartup:
      listen:
        to:
          one:
            with:
              type: com.virtual-wf-powered-race.events.race.started.v1
  - startup:
      call: http
      with:
        method: post
        endpoint:
          uri: https://virtual-wf-powered-race.com/api/v4/cars/{carId}/start
`})))()}var i;function a(){return(a=e((()=>{i=`#
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
  namespace: test
  name: listen-to-any-while-foreach
  version: "0.1.0"
do:
  - listenToGossips:
      listen:
        to:
          any: []
          until: "\${ false }"
      foreach:
        item: event
        at: i
        do:
          - postToChatApi:
              call: http
              with:
                method: post
                endpoint: https://fake-chat-api.com/room/{roomId}
                body:
                  event: \${ $event }
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
  namespace: test
  name: sample-workflow
  version: 0.1.0
use:
  extensions:
    - mockService:
        extend: call
        when: ($task.with.endpoint != null and ($task.with.endpoint | startswith("https://mocked.service.com"))) or ($task.with.endpoint.uri != null and ($task.with.endpoint.uri | startswith("https://mocked.service.com")))
        before:
          - mockResponse:
              set:
                statusCode: 200
                headers:
                  Content-Type: application/json
                content:
                  foo:
                    bar: baz
              then: exit #using this, we indicate to the workflow we want to exit the extended task, thus just returning what we injected
do:
  - callHttp:
      call: http
      with:
        method: get
        endpoint:
          uri: https://fake.com/sample
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
  namespace: test
  name: raise-not-implemented
  version: "0.1.0"
use:
  errors:
    notImplemented:
      type: https://serverlessworkflow.io/errors/not-implemented
      status: 500
      title: Not Implemented
      detail: \${ "The workflow '\\( $workflow.definition.document.name ):\\( $workflow.definition.document.version )' is a work in progress and cannot be run yet" }
do:
  - notImplemented:
      raise:
        error: notImplemented
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
  namespace: test
  name: run-container-stdin-and-arguments
  version: "0.1.0"
do:
  - setInput:
      set:
        message: Hello World
  - runContainer:
      input:
        from: \${ .message }
      run:
        container:
          image: alpine
          command: |
            input=$(cat)
            echo "STDIN was: $input"
            echo "ARGS are $1 $2"
          stdin: \${ . }
          arguments:
            - Foo
            - Bar
`})))()}var f;function p(){return(p=e((()=>{f=`#
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
  namespace: test
  name: run-container
  version: "0.1.0"
do:
  - runContainer:
      run:
        container:
          image: hello-world
        return: all
`})))()}var m;function h(){return(h=e((()=>{m=`#
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
  dsl: 1.0.3
  namespace: examples
  name: run-script-with-stdin-and-arguments
  version: 1.0.0
do:
  - runScript:
      run:
        script:
          language: javascript
          stdin: "Hello Workflow"
          environment:
            foo: bar
          arguments:
            - hello
          code: |
            // Reading Input from STDIN
            import { readFileSync } from 'node:fs';
            const stdin = readFileSync(process.stdin.fd, 'utf8');
            console.log('stdin > ', stdin) // Output: stdin > Hello Workflow

            // Reading from argv
            const [_, __, arg] = process.argv;
            console.log('arg > ', arg) // Output: arg > hello

            // Reading from env
            const foo = process.env.foo;
            console.log('env > ', foo) // Output: env > bar
`})))()}var g;function Re(){return(Re=e((()=>{g=`#
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
  dsl: 1.0.3
  namespace: examples
  name: run-shell-with-stdin-and-arguments
  version: 1.0.0
do:
  - setInput:
      set:
        message: Hello World
  - runShell:
      input:
        from: \${ .message }
      run:
        shell:
          stdin: \${ . }
          command: |
            input=$(cat)
            echo "STDIN was: $input"
            echo "ARGS are $1 $2"
          arguments:
            - Foo
            - Bar
`})))()}var ze;function Be(){return(Be=e((()=>{ze=`#
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
  namespace: test
  name: run-subflow
  version: "0.1.0"
do:
  - registerCustomer:
      run:
        workflow:
          namespace: test
          name: register-customer
          version: "0.1.0"
          input:
            customer: .user
`})))()}var Ve;function He(){return(He=e((()=>{Ve=`#
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
  namespace: examples
  name: cron-schedule
  version: "0.1.0"
schedule:
  cron: 0 0 * * *
do:
  - backup:
      call: http
      with:
        method: post
        endpoint: https://example.com/api/v1/backup/start
`})))()}var _;function Ue(){return(Ue=e((()=>{_=`#
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
  namespace: examples
  name: event-driven-schedule
  version: "0.1.0"
schedule:
  on:
    one:
      with:
        type: com.example.hospital.events.patients.heartbeat.low
do:
  - callNurse:
      call: http
      with:
        method: post
        endpoint: https://hospital.example.com/api/v1/notify
        body:
          patientId: \${ $workflow.input[0].data.patient.id }
          patientName: \${ $workflow.input[0].data.patient.name }
          roomNumber: \${ $workflow.input[0].data.patient.room.number }
          vitals:
            heartRate: \${ $workflow.input[0].data.patient.vitals.bpm }
            timestamp: \${ $workflow.input[0].data.timestamp }
          message: "Alert: Patient's heartbeat is critically low. Immediate attention required."
`})))()}var We;function Ge(){return(Ge=e((()=>{We=`#
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
  namespace: test
  name: set
  version: "0.1.0"
schedule:
  on:
    one:
      with:
        type: io.serverlessworkflow.samples.events.trigger.v1
do:
  - initialize:
      set:
        startEvent: \${ $workflow.input[0] }
`})))()}var Ke;function qe(){return(qe=e((()=>{Ke=`#
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
# yaml-language-server: $schema=../schema/workflow.yaml
document:
  dsl: "1.0.3"
  namespace: examples
  name: star-wars-homeplanet
  version: "1.0.0"
input:
  schema:
    format: json
    document:
      type: object
      required:
        - id
      properties:
        id:
          type: integer
          description: The id of the star wars character to get
          minimum: 1
do:
  - getStarWarsCharacter:
      call: http
      with:
        method: get
        endpoint: https://swapi.dev/api/people/{id}
        output: response
      export:
        as:
          homeworld: \${ .content.homeworld }
  - getStarWarsHomeworld:
      call: http
      with:
        method: get
        endpoint: \${ $context.homeworld }
`})))()}var Je;function Ye(){return(Ye=e((()=>{Je=`#
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
  namespace: test
  name: sample-workflow
  version: 0.1.0
do:
  - processOrder:
      switch:
        - case1:
            when: .orderType == "electronic"
            then: processElectronicOrder
        - case2:
            when: .orderType == "physical"
            then: processPhysicalOrder
        - default:
            then: handleUnknownOrderType
  - processElectronicOrder:
      set:
        validate: true
        status: fulfilled
      then: exit
  - processPhysicalOrder:
      set:
        inventory: clear
        items: 1
        address: Elmer St
      then: exit
  - handleUnknownOrderType:
      set:
        log: warn
        message: something's wrong
`})))()}var Xe;function Ze(){return(Ze=e((()=>{Xe=`#
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
  name: try-catch-retry
  version: "0.1.0"
use:
  retries:
    default:
      delay:
        seconds: 3
      backoff:
        exponential: {}
      limit:
        attempt:
          count: 5
do:
  - tryGetPet:
      try:
        - getPet:
            call: http
            with:
              method: get
              endpoint: https://petstore.swagger.io/v2/pet/{petId}
      catch:
        errors:
          with:
            type: https://serverlessworkflow.io/spec/1.0.0/errors/communication
            status: 503
        retry: default
`})))()}var Qe;function $e(){return($e=e((()=>{Qe=`#
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
  name: try-catch
  version: "0.1.0"
do:
  - tryGetPet:
      try:
        - getPet:
            call: http
            with:
              method: get
              endpoint: https://petstore.swagger.io/v2/pet/{petId}
      catch:
        errors:
          with:
            type: https://serverlessworkflow.io/spec/1.0.0/errors/communication
            status: 404
        as: error
        do:
          - notifySupport:
              emit:
                event:
                  with:
                    source: https://petstore.swagger.io
                    type: io.swagger.petstore.events.pets.not-found.v1
                    data: \${ $error }
          - setError:
              set:
                error: $error
              export:
                as: "$context + { error: $error }"
  - buyPet:
      if: $context.error == null
      call: http
      with:
        method: put
        endpoint: https://petstore.swagger.io/v2/pet/{petId}
        body: '\${ . + { status: "sold" } }'
`})))()}var et;function tt(){return(tt=e((()=>{et=`#
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
  namespace: test
  name: wait-duration-inline
  version: "0.1.0"
do:
  - wait30Seconds:
      wait:
        seconds: 30
`})))()}var nt,rt,it,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$,at;function ot(){return(ot=e((()=>{te(),ie(),oe(),ce(),ue(),fe(),me(),ge(),ve(),be(),Se(),we(),Ee(),Oe(),Ae(),Me(),Pe(),Ie(),t(),r(),a(),s(),l(),d(),p(),h(),Re(),Be(),He(),Ue(),Ge(),qe(),Ye(),Ze(),$e(),tt(),nt=ee(),rt={title:`Examples/Workflows`,component:ne,parameters:{layout:`fullscreen`},render:(e,{globals:ee})=>(0,nt.jsx)(ne,{...e,colorMode:e.colorMode??ee.colorMode??`system`})},it={isReadOnly:!0,locale:`en`},v=e=>({args:{...it,content:e}}),y=v(re),b=v(ae),x=v(se),S=v(le),C=v(de),w=v(pe),T=v(he),E=v(_e),D=v(ye),O=v(xe),k=v(Ce),A=v(Te),j=v(De),M=v(ke),N=v(je),P=v(Ne),F=v(Fe),I=v(Le),L=v(n),R=v(i),z=v(o),B=v(c),V=v(u),H=v(f),U=v(m),W=v(g),G=v(ze),K=v(Ve),q=v(_),J=v(We),Y=v(Ke),X=v(Je),Z=v(Xe),Q=v(Qe),$=v(et),y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.accumulateRoomReadings)`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.authenticationOAuth2)`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.authenticationReusable)`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callAsyncAPIPublish)`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callAsyncAPISubscribe)`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callCustomFunctionCataloged)`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callCustomFunctionInline)`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callGrpc)`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callHttpQueryHeadersExpressions)`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callMCP)`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.callOpenApi)`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.conditionalTask)`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.doMultiple)`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.doSingle)`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.emit)`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.forExample)`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.fork)`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.listenToAll)`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.listenToOne)`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.listenToAnyForeverForeach)`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.mockServiceExtension)`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.raiseReusable)`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.runContainerStdinAndArguments)`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.runReturnAll)`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.runScriptWithStdinAndArguments)`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.runShellStdinAndArguments)`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.runSubflow)`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.scheduleCron)`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.scheduleEventDriven)`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.set)`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.starWarsHomeworld)`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.switchThenString)`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.tryCatchRetryReusable)`,...Z.parameters?.docs?.source}}},Q.parameters={...Q.parameters,docs:{...Q.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.tryCatchThen)`,...Q.parameters?.docs?.source}}},$.parameters={...$.parameters,docs:{...$.parameters?.docs,source:{originalSource:`createWorkflowStory(workflows.waitDurationInline)`,...$.parameters?.docs?.source}}},at=`AccumulateRoomReadings.AuthenticationOAuth2.AuthenticationReusable.CallAsyncAPIPublish.CallAsyncAPISubscribe.CallCustomFunctionCataloged.CallCustomFunctionInline.CallGrpc.CallHttpQueryHeadersExpressions.CallMCP.CallOpenAPI.ConditionalTask.DoMultiple.DoSingle.Emit.For.Fork.ListenToAll.ListenToOne.ListenToAnyForeverForeach.MockServiceExtension.RaiseReusable.RunContainerStdinAndArguments.RunReturnAll.RunScriptWithStdinAndArguments.RunShellStdinAndArguments.RunSubflow.ScheduleCron.ScheduleEventDriven.SetExample.StarWarsHomeworld.SwitchThenString.TryCatchRetryReusable.TryCatchThen.WaitDurationInline`.split(`.`)})))()}ot();export{y as AccumulateRoomReadings,b as AuthenticationOAuth2,x as AuthenticationReusable,S as CallAsyncAPIPublish,C as CallAsyncAPISubscribe,w as CallCustomFunctionCataloged,T as CallCustomFunctionInline,E as CallGrpc,D as CallHttpQueryHeadersExpressions,O as CallMCP,k as CallOpenAPI,A as ConditionalTask,j as DoMultiple,M as DoSingle,N as Emit,P as For,F as Fork,I as ListenToAll,R as ListenToAnyForeverForeach,L as ListenToOne,z as MockServiceExtension,B as RaiseReusable,V as RunContainerStdinAndArguments,H as RunReturnAll,U as RunScriptWithStdinAndArguments,W as RunShellStdinAndArguments,G as RunSubflow,K as ScheduleCron,q as ScheduleEventDriven,J as SetExample,Y as StarWarsHomeworld,X as SwitchThenString,Z as TryCatchRetryReusable,Q as TryCatchThen,$ as WaitDurationInline,at as __namedExportsOrder,rt as default};