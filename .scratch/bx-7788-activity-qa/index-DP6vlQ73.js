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
import { T as Time } from "./index-C1NQKYI1.js";
import { d as optionsWelfareType } from "./common.data-C2W5MmfD.js";
import { b7 as dayjs, aS as h, bj as InputNumber, bG as Input, ep as InputGroup, d as defineComponent, mQ as playerWalfareInvoiceList, q as resolveComponent, s as openBlock, t as createElementBlock, i as createVNode, C as withCtx, y as createTextVNode, f as unref, L as toRaw, dV as formatToDateTime } from "./index-qnpxwRIS.js";
import { j as jsonToSheetXlsx } from "./index-Dc8sl9Nq.js";
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
const schemas = [
  {
    field: "[receiveTimeBegin, receiveTimeEnd]",
    label: " ",
    component: "RangePicker",
    componentProps: {
      placeholder: ["领取时间(开始)", "领取时间(结束)"],
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
    field: "type",
    component: "Select",
    label: " ",
    componentProps: {
      placeholder: "类型",
      options: optionsWelfareType
    }
  },
  {
    field: "[amountBegin, amountEnd]",
    label: " ",
    component: "InputGroup",
    render: ({ model }) => {
      return h(
        InputGroup,
        {
          compact: true,
          style: {
            display: "flex"
          }
        },
        [
          h(InputNumber, {
            maxlength: 8,
            placeholder: "金额(最小)",
            value: model["amountBegin"],
            onChange: (e) => {
              model["amountBegin"] = e;
            }
          }),
          h(Input, {
            value: "～",
            style: {
              width: "54px",
              borderLeft: 0,
              textAlign: "center",
              pointerEvents: "none",
              backgroundColor: "#fff"
            },
            disabled: true
          }),
          h(InputNumber, {
            maxlength: 8,
            style: { borderLeft: 0 },
            placeholder: "金额(最大)",
            value: model["amountEnd"],
            onChange: (e) => {
              model["amountEnd"] = e;
            }
          })
        ]
      );
    },
    colProps: {
      xl: 6,
      xxl: 6
    }
  }
];
const columns = [
  {
    title: "会员账号",
    dataIndex: "playerUsername"
  },
  {
    title: "订单号",
    dataIndex: "tradeNo"
  },
  {
    title: "金额",
    dataIndex: "amount"
  },
  {
    title: "类型",
    dataIndex: "type",
    customRender: ({ text }) => {
      var _a;
      return (_a = optionsWelfareType.find((i) => i.value === text)) == null ? void 0 : _a.label;
    }
  },
  {
    title: "领取时间",
    dataIndex: "receiveTime",
    customRender: ({ text }) => text ? h(Time, { value: text, mode: "datetime" }) : "-"
  }
];
const _hoisted_1 = { class: "" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "index",
  setup(__props) {
    const [registerTable, { getDataSource, getColumns }] = useTable({
      api: playerWalfareInvoiceList,
      columns,
      formConfig: {
        labelWidth: 10,
        schemas,
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
        data: toRaw(getDataSource()).map((e) => {
          var _a;
          return __spreadProps(__spreadValues({}, e), {
            type: (_a = optionsWelfareType.find((i) => i.value === e.type)) == null ? void 0 : _a.label,
            tradeNo: e.tradeNo + "	",
            receiveTime: e.receiveTime ? formatToDateTime(e.receiveTime) + "	" : "-"
          });
        }),
        header,
        filename: "领取记录.csv"
      });
    }
    return (_ctx, _cache) => {
      const _component_a_button = resolveComponent("a-button");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(unref(BasicTable), { onRegister: unref(registerTable) }, {
          toolbar: withCtx(() => [
            createVNode(_component_a_button, { onClick: excel }, {
              default: withCtx(() => [..._cache[0] || (_cache[0] = [
                createTextVNode("导出", -1)
              ])]),
              _: 1
            })
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
