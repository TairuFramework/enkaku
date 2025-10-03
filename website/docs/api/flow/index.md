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

> **new MissingHandlerError**(`action`): [`MissingHandlerError`](#missinghandlererror)

###### Parameters

###### action

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

### CreateFlowParams

> **CreateFlowParams**\<`State`, `Handlers`\> = `object`

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Properties

##### handlers

> **handlers**: `Handlers`

##### stateValidator?

> `optional` **stateValidator**: [`Validator`](../schema/index.md#validator)\<`State`\>

***

### CreateGeneratorParams

> **CreateGeneratorParams**\<`State`, `Handlers`\> = [`CreateFlowParams`](#createflowparams)\<`State`, `Handlers`\> & [`GenerateFlowParams`](#generateflowparams)\<`State`, `Handlers`\>

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

***

### FlowAction

> **FlowAction**\<`State`, `Handlers`, `Action`\> = `object`

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

##### Action

`Action` *extends* keyof `Handlers` = keyof `Handlers`

#### Properties

##### name

> **name**: `Action` & `string`

##### params

> **params**: `Parameters`\<`Handlers`\[`Action`\]\>\[`0`\]\[`"params"`\]

***

### FlowGenerator

> **FlowGenerator**\<`State`, `Handlers`\> = `AsyncGenerator`\<[`GeneratorValue`](#generatorvalue)\<`State`\>, [`GeneratorDoneValue`](#generatordonevalue)\<`State`\> \| `undefined`, [`GenerateNext`](#generatenext)\<`State`, `Handlers`\> \| `undefined`\> & `object`

#### Type Declaration

##### events

> **events**: [`EventEmitter`](../event/index.md#eventemitter)\<[`HandlersEvents`](#handlersevents)\<`State`, `Handlers`\>\>

##### getState()

> **getState**(): `Readonly`\<`State`\>

###### Returns

`Readonly`\<`State`\>

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

***

### GenerateFlowParams

> **GenerateFlowParams**\<`State`, `Handlers`\> = `object`

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Properties

##### action?

> `optional` **action**: [`FlowAction`](#flowaction)\<`State`, `Handlers`\>

##### signal?

> `optional` **signal**: `AbortSignal`

##### state

> **state**: `State`

***

### GenerateNext

> **GenerateNext**\<`State`, `Handlers`\> = `object`

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Properties

##### action?

> `optional` **action**: [`FlowAction`](#flowaction)\<`State`, `Handlers`\>

##### signal?

> `optional` **signal**: `AbortSignal`

##### state?

> `optional` **state**: `State`

***

### GeneratorDoneValue

> **GeneratorDoneValue**\<`State`\> = \{ `reason`: `string`; `state`: `State`; `status`: `"aborted"`; \} \| \{ `state`: `State`; `status`: `"end"`; \} \| \{ `error`: `Error`; `state`: `State`; `status`: `"error"`; \}

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

***

### GeneratorValue

> **GeneratorValue**\<`State`, `Params`\> = [`GeneratorDoneValue`](#generatordonevalue)\<`State`\> \| \{ `action`: `string`; `params`: `Params`; `state`: `State`; `status`: `"action"`; \} \| \{ `state`: `State`; `status`: `"state"`; \}

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Params

`Params` = `unknown`

***

### GenericHandlerContext

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

### Handler()

> **Handler**\<`State`, `Params`, `Events`\> = (`context`) => [`GeneratorValue`](#generatorvalue)\<`State`\> \| `Promise`\<[`GeneratorValue`](#generatorvalue)\<`State`\>\>

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Params

`Params` *extends* `Record`\<`string`, `unknown`\>

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

#### Parameters

##### context

[`HandlerExecutionContext`](#handlerexecutioncontext)\<`State`, `Params`, `Events`\>

#### Returns

[`GeneratorValue`](#generatorvalue)\<`State`\> \| `Promise`\<[`GeneratorValue`](#generatorvalue)\<`State`\>\>

***

### HandlerEvents

> **HandlerEvents**\<`H`\> = `H` *extends* [`Handler`](#handler)\<`Record`\<`string`, `unknown`\>, `Record`\<`string`, `unknown`\>, infer Events\> ? `Events` : `never`

#### Type Parameters

##### H

`H`

***

### HandlerExecutionContext

> **HandlerExecutionContext**\<`State`, `Params`, `Events`\> = [`GenericHandlerContext`](#generichandlercontext)\<`Events`\> & `object`

#### Type Declaration

##### params

> **params**: `Params`

##### state

> **state**: `State`

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Params

`Params` *extends* `Record`\<`string`, `unknown`\>

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

***

### HandlersEvents

> **HandlersEvents**\<`State`, `Handlers`\> = `{ [K in keyof Handlers]: HandlerEvents<Handlers[K]> }`\[keyof `Handlers`\]

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`\>

***

### HandlersRecord

> **HandlersRecord**\<`State`, `Events`\> = `object`

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Events

`Events` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `never`\>

#### Index Signature

\[`K`: `string`\]: [`Handler`](#handler)\<`State`, `any`, `Events`\>

## Functions

### createFlow()

> **createFlow**\<`State`, `Handlers`\>(`flowParams`): (`params`) => [`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>

#### Type Parameters

##### State

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

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

`State` *extends* `Record`\<`string`, `unknown`\>

##### Handlers

`Handlers` *extends* [`HandlersRecord`](#handlersrecord)\<`State`, `Record`\<`string`, `unknown`\>\> = [`HandlersRecord`](#handlersrecord)\<`State`\>

#### Parameters

##### params

[`CreateGeneratorParams`](#creategeneratorparams)\<`State`, `Handlers`\>

#### Returns

[`FlowGenerator`](#flowgenerator)\<`State`, `Handlers`\>
