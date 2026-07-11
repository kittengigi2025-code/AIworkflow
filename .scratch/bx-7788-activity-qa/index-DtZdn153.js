var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
import { B as BasicTable } from "./BasicTable-BiPOv4aB.js";
import "./index-B2HbZhjI.js";
import "./TableImg.vue_vue_type_style_index_0_lang-HDmD9Lvw.js";
import { u as useTable } from "./useTable-DdsNt3eg.js";
import { b7 as dayjs, aK as useUserStore, b5 as useOperationStoreWithOut, b6 as CURRENCY_ENUM, aS as h, d as defineComponent, mP as playerExchange, q as resolveComponent, s as openBlock, t as createElementBlock, i as createVNode, C as withCtx, f as unref, bj as InputNumber, bg as filterBtnPermission, v as createBlock, y as createTextVNode, x as createCommentVNode, L as toRaw, dV as formatToDateTime } from "./index-qnpxwRIS.js";
import { j as jsonToSheetXlsx } from "./index-Dc8sl9Nq.js";
import { T as Time } from "./index-C1NQKYI1.js";
import "./useForm-Cg-QMwDR.js";
import "./BasicForm.vue_vue_type_style_index_0_lang-eHbP9IiC.js";
import "./index-B6yns6cu.js";
import "./index-CAMgkY6W.js";
import "./uniqBy-DQvTVx3M.js";
import "./index-CwJ7Rm6V.js";
import "./useWindowSizeFn-B_Ja1_z6.js";
import "./index-DFr64a2-.js";
import "./onMountedOrActivated-B2tyjCqR.js";
import "./useContentViewHeight-BP__YUwc.js";
import "./useColumns-UVcQ56Sv.js";
import "./EditableCell.vue_vue_type_style_index_0_lang-P4gCaL5I.js";
import "./uuid-Bpf7GDyq.js";
import "./merge-DM4jhQRa.js";
import "./useModal-CYU1mrTZ.js";
import "./sortable.esm-DZMr0zLl.js";
const playerExchangeSearchSchema = [
  {
    field: "[createTimeBegin, createTimeEnd]",
    label: " ",
    component: "RangePicker",
    componentProps: {
      placeholder: ["兑换时间(开始)", "兑换时间(结束)"],
      showTime: {
        defaultValue: [dayjs("00:00:00", "HH:mm:ss"), dayjs("23:59:59", "HH:mm:ss")]
      }
    },
    colProps: {
      xl: 8,
      xxl: 6
    }
  },
  {
    field: "siteId",
    label: " ",
    component: "Select",
    componentProps: {
      placeholder: "注册站点",
      options: useOperationStoreWithOut().getSiteList
    },
    ifShow: () => {
      const userStore = useUserStore();
      return userStore.getRoleType;
    }
  },
  {
    field: "tradeNo",
    component: "Input",
    label: " ",
    componentProps: {
      placeholder: "订单号",
      onChange: (e) => {
        e.target.value = e.target.value.replace(/[^\d]/g, "");
      },
      maxlength: 19
    }
  },
  {
    field: "playerUsername",
    component: "Input",
    label: " ",
    componentProps: {
      placeholder: "会员账号"
    }
  },
  {
    field: "code",
    component: "Select",
    label: " ",
    componentProps: ({ formModel }) => {
      return {
        placeholder: "钱包币种",
        options: CURRENCY_ENUM.withoutBTC(),
        onChange: (e) => {
          const item = CURRENCY_ENUM[e];
          formModel["protocol"] = item == null ? void 0 : item.protocol;
          formModel["currency"] = item == null ? void 0 : item.currency;
        }
      };
    }
  },
  {
    field: "[minAmount, maxAmount]",
    label: " ",
    component: "InputGroup",
    slot: "numberRange",
    componentProps: {
      placeholder: ["金额(最小)", "金额(最大)"]
    },
    colProps: {
      xl: 8,
      xxl: 6
    }
  }
];
const playerExchangeColumns = [
  {
    title: "会员账号",
    dataIndex: "playerUsername"
  },
  {
    title: "订单号",
    dataIndex: "tradeNo",
    width: 220,
    copy: true
  },
  {
    title: "金额",
    dataIndex: "amount"
  },
  {
    title: "钱包币种",
    dataIndex: "targetCurrency",
    customRender: ({ record }) => {
      const currency = CURRENCY_ENUM[record.targetProtocol ? `${record.targetCurrency}_${record.targetProtocol}` : record.targetCurrency];
      return (currency == null ? void 0 : currency.protocol) ? `${currency == null ? void 0 : currency.currency}-${currency == null ? void 0 : currency.protocol}` : currency == null ? void 0 : currency.label;
    }
  },
  // {
  //   title: '协议',
  //   dataIndex: 'protocol',
  //   customRender: ({ text }) => text || '-',
  // },
  {
    title: "兑换时间",
    dataIndex: "createTime",
    customRender: ({ text }) => text ? h(Time, { value: text, mode: "datetime" }) : "-"
  },
  {
    title: "注册站点",
    dataIndex: "siteName",
    ifShow: () => {
      const userStore = useUserStore();
      return userStore.getRoleType;
    }
  }
];
const _hoisted_1 = { class: "" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "index",
  setup(__props) {
    const [registerTable, { getColumns, getDataSource }] = useTable({
      api: playerExchange,
      columns: playerExchangeColumns,
      formConfig: {
        labelWidth: 10,
        schemas: playerExchangeSearchSchema,
        baseColProps: {
          xl: 4,
          xxl: 3
        }
      },
      striped: true,
      useSearchForm: true,
      showTableSetting: true,
      bordered: true,
      canResize: false,
      showIndexColumn: false,
      rowKey: "id"
    });
    function excel() {
      let header = {};
      toRaw(getColumns()).forEach((e) => {
        if (e.dataIndex) {
          header[e.dataIndex] = e.title;
        }
      });
      jsonToSheetXlsx({
        data: toRaw(getDataSource()).map((e) => __spreadProps(__spreadValues({}, e), {
          tradeNo: e.tradeNo + "	",
          createTime: e.createTime ? formatToDateTime(e.createTime) + "	" : "-"
        })),
        header,
        filename: "会员兑换记录.csv"
      });
    }
    return (_ctx, _cache) => {
      const _component_a_button = resolveComponent("a-button");
      const _component_a_input = resolveComponent("a-input");
      const _component_a_input_group = resolveComponent("a-input-group");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(unref(BasicTable), { onRegister: unref(registerTable) }, {
          toolbar: withCtx(() => [
            unref(filterBtnPermission)("playerFundsRecords", "WalfareRecord.export") ? (openBlock(), createBlock(_component_a_button, {
              key: 0,
              onClick: excel
            }, {
              default: withCtx(() => [..._cache[0] || (_cache[0] = [
                createTextVNode("导出", -1)
              ])]),
              _: 1
            })) : createCommentVNode("", true)
          ]),
          "form-numberRange": withCtx(({ model }) => [
            createVNode(_component_a_input_group, {
              style: { "display": "flex" },
              compact: ""
            }, {
              default: withCtx(() => [
                createVNode(unref(InputNumber), {
                  value: model["minAmount"],
                  "onUpdate:value": ($event) => model["minAmount"] = $event,
                  placeholder: "福利金额(最小)"
                }, null, 8, ["value", "onUpdate:value"]),
                createVNode(_component_a_input, {
                  value: "至",
                  style: { "width": "54px", "border-left": "0", "pointer-events": "none", "background-color": "#fff" },
                  placeholder: "至",
                  disabled: ""
                }),
                createVNode(unref(InputNumber), {
                  value: model["maxAmount"],
                  "onUpdate:value": ($event) => model["maxAmount"] = $event,
                  style: { "border-left": "0" },
                  placeholder: "福利金额(最大)"
                }, null, 8, ["value", "onUpdate:value"])
              ]),
              _: 2
            }, 1024)
          ]),
          _: 1
        }, 8, ["onRegister"])
      ]);
    };
  }
});
export {
  _sfc_main as default
};
