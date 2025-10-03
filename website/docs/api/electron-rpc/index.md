# @enkaku/electron-rpc

Enkaku RPC using Electron IPC.

## Installation

```sh
npm install @enkaku/electron-rpc
```

## Type Aliases

### CreateProcess()

> **CreateProcess** = \<`R`, `W`\>(`name`, `onMessage`) => [`MessageFunc`](#messagefunc)\<`W`\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Parameters

##### name

`string`

##### onMessage

[`MessageFunc`](#messagefunc)\<`R`\>

#### Returns

[`MessageFunc`](#messagefunc)\<`W`\>

***

### MessageFunc()

> **MessageFunc**\<`T`\> = (`message`) => `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### message

`T`

#### Returns

`void`

***

### PortHandler()

> **PortHandler** = (`port`, `event`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### port

`MessagePortMain`

##### event

`IpcMainEvent`

#### Returns

`void` \| `Promise`\<`void`\>

***

### PortInput

> **PortInput** = [`PortOrPromise`](#portorpromise) \| () => [`PortOrPromise`](#portorpromise)

***

### PortOrPromise

> **PortOrPromise** = `MessagePortMain` \| `Promise`\<`MessagePortMain`\>

***

### RendererClientOptions

> **RendererClientOptions**\<`Protocol`\> = `Omit`\<[`ClientParams`](../client/index.md#clientparams)\<`Protocol`\>, `"transport"`\> & `object`

#### Type Declaration

##### name?

> `optional` **name**: `string`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

***

### ServeProcessParams

> **ServeProcessParams**\<`Protocol`\> = `Omit`\<[`ServerParams`](../server/index.md#serverparams)\<`Protocol`\>, `"transports"`\> & `object`

#### Type Declaration

##### name?

> `optional` **name**: `string`

#### Type Parameters

##### Protocol

`Protocol` *extends* [`ProtocolDefinition`](../protocol/index.md#protocoldefinition)

## Functions

### createMainTransportStream()

> **createMainTransportStream**\<`R`, `W`\>(`input`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Parameters

##### input

[`PortInput`](#portinput)

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

***

### createRendererClient()

> **createRendererClient**\<`Protocol`\>(`options`): [`Client`](../client/index.md#client)\<`Protocol`, [`ClientDefinitionsType`](../client/index.md#clientdefinitionstype)\<`Protocol`\>\>

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### options

[`RendererClientOptions`](#rendererclientoptions)\<`Protocol`\> = `{}`

#### Returns

[`Client`](../client/index.md#client)\<`Protocol`, [`ClientDefinitionsType`](../client/index.md#clientdefinitionstype)\<`Protocol`\>\>

***

### createRendererTransportStream()

> **createRendererTransportStream**\<`R`, `W`\>(`name`): `Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

#### Type Parameters

##### R

`R`

##### W

`W`

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`ReadableWritablePair`\<`R`, `W`\>\>

***

### serveProcess()

> **serveProcess**\<`Protocol`\>(`params`): `void`

#### Type Parameters

##### Protocol

`Protocol` *extends* `object`

#### Parameters

##### params

[`ServeProcessParams`](#serveprocessparams)\<`Protocol`\>

#### Returns

`void`
