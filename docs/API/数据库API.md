数据库添加非绑定的块和属性值/api/av/appendAttributeViewDetachedBlocksWithValue
avID：数据库 id，非块 id
blocksValues list, 数据库要添加的行
blocksValues 是个二维数组，对应表格视图的行列
参数中的值可以参考源码 kernel/av/value.go 中的 Value 结构体
keyID 是每一列的 id
block、text、mSelect，number 是列类别。注意单选 select 也是用 mSelect
avid = '20241017094451-2urncs9'
const input = {
"avID": avid,
"blocksValues": [
[
{
"keyID": "20241017094451-jwfegvp",
"block": {
"content": "Test block2"
}
},
{
"keyID": "20241017094451-fu1pv7s",
"mSelect": [{"content":"Fiction4"}]

      },
      {
        "keyID": "20241017095436-2wlgb7o",
        "number": {
          "content": 1234
        }
      }
    ]

]
}
const result =await fetchSyncPost('/api/av/appendAttributeViewDetachedBlocksWithValues', input)

数据库添加绑定块/api/av/addAttributeViewBlocks
avID：数据库 id，非数据库块 id，可在 DOM 中找
blockID：数据库块 id，非添加的块 id
srcs
id：块 id
itemID: 数据库行ID
isDetached
false：是绑定块
true：是非绑定块
const docids = ['20240107212802-727hsjv'] // 文档id
const srcs = docids.map(docId => ({
"id": docId,
"isDetached": false,
}));
avid = '20241017094451-2urncs9'; // 数据库

const input = {
"avID": avid,
'srcs': srcs

}
const result =await fetchSyncPost('/api/av/addAttributeViewBlocks', input)

数据库绑定块，同时添加属性
对于绑定块，rowID=docID

avID = '20241017094451-2urncs9' // 数据库ID
keyID = '20241102151935-gypad0k' // 文本列ID
docId = '20211116001448-ny4lvyw' //文档ID
// ------------数据库绑定块 ------------ //
const docids = [docId] // 文档id
const srcs = docids.map(docId => ({
"id": docId,
"isDetached": false,
}));

const input = {
"avID": avID,
'srcs': srcs

}
await fetchSyncPost('/api/av/addAttributeViewBlocks', input)

// ------------设置属性 ------------ //
await fetchSyncPost("/api/av/setAttributeViewBlockAttr", {
avID: avID,
keyID: keyID,
rowID: docId,
value: {
"text": {
"content": '📂Research\n📂Project\n📂Area\n📂Resources\n📂Life'
}
},
});

数据库设置属性/api/av/setAttributeViewBlockAttr
// type: text
let res = await fetchSyncPost("/api/av/setAttributeViewBlockAttr", {
avID: '20241017094451-2urncs9',
keyID: '20241102151935-gypad0k',
rowID: '20211116001448-ny4lvyw',
value: {
"text": {
"content": 'hh\nhhh'
}
},
});

res
// type: number
let res = await fetchSyncPost("/api/av/setAttributeViewBlockAttr", {
avID: '20241017094451-2urncs9',
keyID: '20241017095436-2wlgb7o',
rowID: '20240107212802-727hsjv',
cellID: '20241102151045-ueb6zqn',
value: {
"number": {
"content": 4,
"isNotEmpty": true
}
},
});

res

// type: single select
let res = await fetchSyncPost("/api/av/setAttributeViewBlockAttr", {
avID: '20241017094451-2urncs9',
keyID: '20241017094451-fu1pv7s',
rowID: '20241017094453-65uzx7e',
cellID: '20241017094455-9mj9255',
value: {
"mSelect":
[{"content":"Fiction4"}]

        },

});

res

// type: multiple Select
let res = await fetchSyncPost("/api/av/setAttributeViewBlockAttr", {
avID: '20241017094451-2urncs9',
keyID: '20241017101851-kekovwz',
rowID: '20241017094453-65uzx7e',
cellID: '20241017102149-2jimfjh',
value: {
"mSelect": [{"content":"Fiction3"}]
},
});

res

获取数据库的所有 key（列 id）/api/av/getAttributeViewKeysByAvID
let res = await fetchSyncPost("/api/av/getAttributeViewKeysByAvID", {
avID: '20241017094451-2urncs9'
});

res

查询哪些数据库包含了这个块 getAttributeViewKeys
let res = await fetchSyncPost("/api/av/getAttributeViewKeys", {
id: '20211116001448-ny4lvyw'
});

res

已知 rowID(docID)和 keyid，如何获取 cellID

let res = await fetchSyncPost("/api/av/getAttributeViewKeys", {
id: '20211116001448-ny4lvyw'
});
const foundItem = res.data.find(item => item.avID === "20241017094451-2urncs9"); //avid
if (foundItem && foundItem.keyValues) {
// 步骤2：在 keyValues 中查找特定 key.id 的项
const specificKey = foundItem.keyValues.find(kv => kv.key.id === "20241102151935-gypad0k"); // keyid

    // 步骤3：获取 values 数组的第一个元素的 id
    if (specificKey && specificKey.values && specificKey.values.length > 0) {
        console.log(specificKey.values[0].id)
        //return specificKey.values[0].id;
    }

}

接口名称：批量设置值
/api/av/batchSetAttributeViewBlockAttrs
示例参数：
注意 itemId 就是行 ID，对应 renderAttributeView 接口的返回字段为 data.view.rows[0].id
{
"avID": "20250716235026-51p7441",
"values": [
{
"keyID": "20250716235026-njmx362",
"itemID": "20250716235124-6qqlnpw",
"value": {
"block": {
"content": "Test"
}
}
},
{
"keyID": "20250716235026-a0v1j35",
"itemID": "20250716235124-6qqlnpw",
"value": {
"number": {
"content": 111
}
}
}
]
}

接口名：添加属性视图列 (Key)
接口地址：/api/av/addAttributeViewKey
POST

请求参数
参数名 类型 必选 描述
avID string 是 属性视图 ID。
key object 是 要添加的列信息 (结构见下)。
key.name string 是 列的名称。
key.type string 是 列的类型 (例如: 'text', 'number', 'select', 'multiSelect', 'date', 'url', 'email', 'phone', 'checkbox', 'relation', 'rollup')。
key.icon string 否 列的图标 (emoji)。
key.options object[] 否 （仅限 select/multiSelect 类型）选项列表，每个选项包含 `name`, `color`。
返回值
返回新创建的列的信息。

参数名 类型 描述
code number 返回码，0表示成功
msg string 返回信息
data object 新创建的列信息。
data.id string 新列的 ID。
data.name string 列的名称。
data.type string 列的类型。

接口说明：根据数据库 itemId 查询 blockId
接口地址：/api/av/getAttributeViewBoundBlockIDsByItemIDs
参数：

{
"avID": "20250829105223-fk06kth",
"itemIDs": ["20250830173630-y0h4nrx", "20250830185837-4ww0kcq", "20250830185839-l1eav89"]
}
返回值：

{
"code": 0,
"msg": "",
"data": {
"20250830173630-y0h4nrx": "20250829105224-mh7mtd2",
"20250830185837-4ww0kcq": "20250829105226-8o6pfqb",
"20250830185839-l1eav89": ""
}
}
"20250830185839-l1eav89": "" 值为空说明是非绑定块

接口说明：根据数据库 blockId 查询 itemId
接口地址：/api/av/getAttributeViewItemIDsByBoundIDs
接口来源：https://github.com/siyuan-note/siyuan/issues/15708#issuecomment-3239193496
参数：

{
"avID": "20250829105223-fk06kth",
"blockIDs": ["20250829105224-mh7mtd2", "20250829105226-8o6pfqb"]
}
返回值：

{
"code": 0,
"msg": "",
"data": {
"20250829105224-mh7mtd2": "20250830173630-y0h4nrx",
"20250829105226-8o6pfqb": "20250830185837-4ww0kcq"
}
}

作者：Achuan-2
链接：https://ld246.com/article/1733365731025
来源：链滴
协议：CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/
