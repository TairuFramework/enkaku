# @enkaku/flow

Stateful flow execution.

## Installation

```sh
npm install @enkaku/flow
```

## Classes

### MissingHandlerError

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new MissingHandlerError**(`taskName`): [`MissingHandlerError`](#missinghandlererror)

###### Parameters

###### taskName

`string`

###### Returns

[`MissingHandlerError`](#missinghandlererror)

###### Overrides

`Error.constructor`

#### Properties

##### name

> **name**: `string` = `'MissingHandler'`

###### Overrides

`Error.name`

## Type Aliases

### CreateFlowParams\<State, Handlers\>

> **CreateFlowParams**\<`State`, `Handlers`\> = `object`

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Properties

##### handlers

> **handlers**: `Handlers`

##### stateValidator

> **stateValidator**: [`Validator`](../schema/index.md#validator)\<`State`\>

***

### CreateGeneratorParams\<State, Handlers\>

> **CreateGeneratorParams**\<`State`, `Handlers`\> = [`CreateFlowParams`](#createflowparams)\<`State`, `Handlers`\> & [`GenerateFlowParams`](#generateflowparams)\<`State`, `Handlers`\>

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

***

### FlowGenerator\<State, Handlers\>

> **FlowGenerator**\<`State`, `Handlers`\> = `AsyncGenerator`\<[`HandlerOutput`](#handleroutput)\<`State`\>, [`HandlerReturnOutput`](#handlerreturnoutput)\<`State`\>, [`GenerateNext`](#generatenext)\<`State`, `Handlers`\>\> & `object`

#### Type declaration

##### events

> **events**: [`EventEmitter`](../event/index.md#eventemitter)\<[`HandlersEvents`](#handlersevents)\<`State`, `Handlers`\>\>

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

***

### FlowTask\<State, Handlers, Task\>

> **FlowTask**\<`State`, `Handlers`, `Task`\> = `object`

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

##### Task

`Task` *extends* keyof `Handlers` = keyof `Handlers`

#### Properties

##### name

> **name**: `Task` & `string`

##### params

> **params**: `Handlers`\[`Task`\] *extends* [`Handler`](#handler)\<`State`, infer P, `Record`\<`string`, `unknown`\>\> ? `P` : `never`

***

### GenerateFlowParams\<State, Handlers\>

> **GenerateFlowParams**\<`State`, `Handlers`\> = `object`

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Properties

##### signal?

> `optional` **signal**: `AbortSignal`

##### state

> **state**: `State`

##### task?

> `optional` **task**: [`FlowTask`](#flowtask)\<`State`, `Handlers`\>

***

### GenerateNext\<State, Handlers\>

> **GenerateNext**\<`State`, `Handlers`\> = `object`

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Properties

##### state?

> `optional` **state**: `State`

##### task

> **task**: [`FlowTask`](#flowtask)\<`State`, `Handlers`\>

***

### GenericHandlerContext\<Events\>

> **GenericHandlerContext**\<`Events`\> = `object`

#### Type Parameters

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

#### Properties

##### emit

> **emit**: [`EventEmitter`](../event/index.md#eventemitter)\<`Events`\>\[`"emit"`\]

##### signal?

> `optional` **signal**: `AbortSignal`

***

### Handler()\<State, Params, Events\>

> **Handler**\<`State`, `Params`, `Events`\> = (`context`) => [`HandlerOutput`](#handleroutput)\<`State`\> \| `Promise`\<[`HandlerOutput`](#handleroutput)\<`State`\>\>

#### Type Parameters

##### State

`State`

##### Params

`Params`

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

#### Parameters

##### context

[`HandlerExecutionContext`](#handlerexecutioncontext)\<`State`, `Params`, `Events`\>

#### Returns

[`HandlerOutput`](#handleroutput)\<`State`\> \| `Promise`\<[`HandlerOutput`](#handleroutput)\<`State`\>\>

***

### HandlerEvents\<H\>

> **HandlerEvents**\<`H`\> = `H` *extends* [`Handler`](#handler)\<`unknown`, `unknown`, infer Events\> ? `Events` : `never`

#### Type Parameters

##### H

`H`

***

### HandlerExecutionContext\<State, Params, Events\>

> **HandlerExecutionContext**\<`State`, `Params`, `Events`\> = [`GenericHandlerContext`](#generichandlercontext)\<`Events`\> & `object`

#### Type declaration

##### params

> **params**: `Params`

##### state

> **state**: `State`

#### Type Parameters

##### State

`State`

##### Params

`Params`

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

***

### HandlerOutput\<State, Params\>

> **HandlerOutput**\<`State`, `Params`\> = [`HandlerReturnOutput`](#handlerreturnoutput)\<`State`\> \| \{ `params`: `Params`; `state`: `State`; `status`: `"next"`; `task`: `string`; \}

#### Type Parameters

##### State

`State`

##### Params

`Params` = `unknown`

***

### HandlerReturnOutput\<State\>

> **HandlerReturnOutput**\<`State`\> = \{ `reason`: `string`; `state`: `State`; `status`: `"aborted"`; \} \| \{ `state`: `State`; `status`: `"ended"`; \} \| \{ `error`: `Error`; `state`: `State`; `status`: `"error"`; \}

#### Type Parameters

##### State

`State`

***

### HandlersEvents\<State, Handlers\>

> **HandlersEvents**\<`State`, `Handlers`\> = `{ [K in keyof Handlers]: HandlerEvents<Handlers[K]> }`\[keyof `Handlers`\]

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

***

### HandlersRecord\<State, Events\>

> **HandlersRecord**\<`State`, `Events`\> = `object`

#### Type Parameters

##### State

`State`

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

#### Index Signature

\[`K`: `string`\]: [`Handler`](#handler)\<`State`, `any`, `Events`\>

## Functions

### createFlow()

> **createFlow**\<`State`, `Handlers`\>(`flowParams`): (`params`) => [`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Parameters

##### flowParams

[`CreateFlowParams`](#createflowparams)\<`State`, `Handlers`\>

#### Returns

> (`params`): [`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>

##### Parameters

###### params

[`GenerateFlowParams`](#generateflowparams)\<`State`, `Handlers`\>

##### Returns

[`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>

***

### createGenerator()

> **createGenerator**\<`State`, `Handlers`\>(`params`): [`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>

#### Type Parameters

##### State

`State`

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Parameters

##### params

[`CreateGeneratorParams`](#creategeneratorparams)\<`State`, `Handlers`\>

#### Returns

[`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>
