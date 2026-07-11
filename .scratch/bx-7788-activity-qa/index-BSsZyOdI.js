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
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
import { B as BasicTable } from "./BasicTable-BiPOv4aB.js";
import { T as TableAction } from "./index-B2HbZhjI.js";
import "./TableImg.vue_vue_type_style_index_0_lang-HDmD9Lvw.js";
import { u as useTable } from "./useTable-DdsNt3eg.js";
import { d as defineComponent, q as resolveComponent, s as openBlock, t as createElementBlock, i as createVNode, C as withCtx, G as Fragment, f as unref, bg as filterBtnPermission, v as createBlock, y as createTextVNode, z as toDisplayString, ab as createBaseVNode, w as normalizeClass, L as toRaw, x as createCommentVNode, aS as h, cN as Button, bO as useMessage, o as _export_sfc } from "./index-qnpxwRIS.js";
import { u as useFormContext } from "./BasicForm.vue_vue_type_style_index_0_lang-eHbP9IiC.js";
import "./index-CwJ7Rm6V.js";
import { b as redeemCodePage, i as redeemCodeCopy, j as redeemCodeDelete, k as redeemCodeUpdateStatus } from "./redeemCode-bXRkpOGW.js";
import { w as normalizeRedeemCodeListParams, x as columns, y as getListFormConfig, z as isCommonRedeemCodeType, A as isRedeemCodeIssueDisabled, s as resolveRedeemCodeListTotal } from "./table.data-CVRkNcgM.js";
import { _ as _sfc_main$1 } from "./ViewRedeemCodeModal.vue_vue_type_script_setup_true_lang-CLPe6xVa.js";
import ImageTextConfigModal from "./ImageTextConfigModal-D3UOugsx.js";
import AddModal from "./AddModal-g3yfB4lT.js";
import { _ as _sfc_main$2 } from "./IssueModal.vue_vue_type_script_setup_true_lang-BJmwIgnM.js";
import { u as useModal } from "./useModal-CYU1mrTZ.js";
import "./useForm-Cg-QMwDR.js";
import "./uniqBy-DQvTVx3M.js";
import "./index-DFr64a2-.js";
import "./onMountedOrActivated-B2tyjCqR.js";
import "./useWindowSizeFn-B_Ja1_z6.js";
import "./useContentViewHeight-BP__YUwc.js";
import "./useColumns-UVcQ56Sv.js";
import "./EditableCell.vue_vue_type_style_index_0_lang-P4gCaL5I.js";
import "./uuid-Bpf7GDyq.js";
import "./merge-DM4jhQRa.js";
import "./sortable.esm-DZMr0zLl.js";
import "./index-B6yns6cu.js";
import "./index-CAMgkY6W.js";
import "./index-C1NQKYI1.js";
import "./useGoMemberDetails-DlnxyqPo.js";
import "./download-31rsrKDP.js";
import "./upload-C_i8kVeq.js";
import "./RewardAmountField-TTo_wSeF.js";
import "./SpecifiedIdsField-VAuxc9jf.js";
const _hoisted_1 = { class: "m-4 p-5 bg-white" };
const _hoisted_2 = { key: 1 };
const _hoisted_3 = { key: 1 };
const _hoisted_4 = {
  key: 0,
  class: "redeem-code-status-text is-deleted"
};
const _hoisted_5 = {
  key: 1,
  class: "redeem-code-status-cell"
};
const __default__ = { name: "RedeemCode" };
const _sfc_main = /* @__PURE__ */ defineComponent(__spreadProps(__spreadValues({}, __default__), {
  setup(__props) {
    const { createConfirm, createMessage } = useMessage();
    const RedeemCodeSearchActions = defineComponent({
      name: "RedeemCodeSearchActions",
      setup() {
        const { submitAction, resetAction } = useFormContext();
        return () => h(
          "div",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              paddingLeft: "8px"
            }
          },
          [
            h(Button, { onClick: () => resetAction() }, () => "重置"),
            h(Button, { type: "primary", onClick: () => submitAction() }, () => "查询")
          ]
        );
      }
    });
    const [imageTextConfigRegister, { openModal: openImageTextConfigModal }] = useModal();
    const [addRegister, { openModal: openAddModal }] = useModal();
    const [viewRedeemCodeRegister, { openModal: openViewRedeemCodeModal }] = useModal();
    const [issueRegister, { openModal: openIssueModal }] = useModal();
    const openImageTextConfig = () => {
      openImageTextConfigModal(true, {});
    };
    function getRedeemCodeListTotal() {
      const pagination = getPaginationRef();
      const raw = getRawDataSource();
      return resolveRedeemCodeListTotal(pagination.total, raw == null ? void 0 : raw.total);
    }
    const openViewRedeemCode = (record) => {
      openViewRedeemCodeModal(true, {
        record: toRaw(record),
        redeemCodeListTotal: getRedeemCodeListTotal()
      });
    };
    const openAdd = () => {
      openAddModal(true, {});
    };
    function openIssue(record) {
      openIssueModal(true, { record: toRaw(record) });
    }
    function openCopyConfirm(record) {
      createConfirm({
        iconType: "info",
        title: "确认复制",
        content: "确认复制配置内容，并创建兑换码吗？",
        onOk: () => __async(this, null, function* () {
          const copied = yield redeemCodeCopy(record.id);
          openAddModal(true, { copyData: copied });
        })
      });
    }
    function handleDelete(record) {
      return __async(this, null, function* () {
        yield redeemCodeDelete(record.id);
        createMessage.success("删除成功");
        yield reload();
      });
    }
    function openDeleteConfirm(record) {
      var _a;
      const name = (_a = record.name) != null ? _a : "兑换码";
      createConfirm({
        iconType: "warning",
        title: "删除兑换码",
        content: () => h("div", [
          h("p", { style: { margin: "0 0 8px" } }, "删除之后，兑换码失效，且查询不到记录"),
          h("p", { style: { margin: 0 } }, `确认删除该「${name}」吗？`)
        ]),
        onOk: () => handleDelete(record)
      });
    }
    function handleStatusChange(record, checked) {
      return __async(this, null, function* () {
        const status = checked ? "Enable" : "Disable";
        const update = () => __async(this, null, function* () {
          try {
            yield redeemCodeUpdateStatus({ id: record.id, status });
            record.status = status;
            yield reload();
          } catch (e) {
            yield reload();
          }
        });
        if (status === "Disable") {
          createConfirm({
            iconType: "warning",
            title: "确认禁用",
            content: "确认将该兑换码禁用？",
            onOk: update,
            onCancel: () => reload()
          });
          return;
        }
        yield update();
      });
    }
    const [registerTable, { reload, getPaginationRef, getRawDataSource }] = useTable({
      api: redeemCodePage,
      columns,
      beforeFetch: normalizeRedeemCodeListParams,
      formConfig: getListFormConfig(),
      pagination: { pageSize: 10, defaultPageSize: 10 },
      striped: true,
      useSearchForm: true,
      showTableSetting: true,
      bordered: true,
      canResize: false,
      showIndexColumn: true,
      indexColumnProps: { width: 48, title: "序号" },
      rowKey: "id",
      actionColumn: {
        width: 280,
        title: "操作",
        dataIndex: "action",
        key: "action",
        fixed: "right"
      }
    });
    return (_ctx, _cache) => {
      const _component_a_button = resolveComponent("a-button");
      const _component_a_switch = resolveComponent("a-switch");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(unref(BasicTable), { onRegister: unref(registerTable) }, {
          "form-formActions": withCtx(() => [
            createVNode(unref(RedeemCodeSearchActions))
          ]),
          toolbar: withCtx(() => [
            unref(filterBtnPermission)("redeemCode", "redeemCode.graphicConfig") ? (openBlock(), createBlock(_component_a_button, {
              key: 0,
              type: "primary",
              class: "mr-2",
              onClick: openImageTextConfig
            }, {
              default: withCtx(() => [..._cache[0] || (_cache[0] = [
                createTextVNode(" 图文配置 ", -1)
              ])]),
              _: 1
            })) : createCommentVNode("", true),
            unref(filterBtnPermission)("redeemCode", "redeemCode.create") ? (openBlock(), createBlock(_component_a_button, {
              key: 1,
              type: "primary",
              onClick: openAdd
            }, {
              default: withCtx(() => [..._cache[1] || (_cache[1] = [
                createTextVNode(" 新增 ", -1)
              ])]),
              _: 1
            })) : createCommentVNode("", true)
          ]),
          bodyCell: withCtx(({ column, record }) => {
            var _a;
            return [
              column.key === "code" ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                !unref(isCommonRedeemCodeType)(record.codeType) ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
                  unref(filterBtnPermission)("redeemCode", "redeemCode.view") ? (openBlock(), createBlock(_component_a_button, {
                    key: 0,
                    type: "link",
                    class: "redeem-code-view-link",
                    onClick: ($event) => openViewRedeemCode(record)
                  }, {
                    default: withCtx(() => [..._cache[2] || (_cache[2] = [
                      createTextVNode(" 点击查看 ", -1)
                    ])]),
                    _: 1
                  }, 8, ["onClick"])) : (openBlock(), createElementBlock("span", _hoisted_2, "-"))
                ], 64)) : (openBlock(), createElementBlock("span", _hoisted_3, toDisplayString((_a = record.code) != null ? _a : "-"), 1))
              ], 64)) : column.key === "status" ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
                record.status === "Deleted" ? (openBlock(), createElementBlock("span", _hoisted_4, " 删除 ")) : (openBlock(), createElementBlock("div", _hoisted_5, [
                  createVNode(_component_a_switch, {
                    size: "small",
                    checked: record.status === "Enable",
                    onChange: (checked) => handleStatusChange(record, checked)
                  }, null, 8, ["checked", "onChange"]),
                  createBaseVNode("span", {
                    class: normalizeClass(["redeem-code-status-text", record.status === "Enable" ? "is-enable" : "is-disable"])
                  }, toDisplayString(record.status === "Enable" ? "启用" : "禁用"), 3)
                ]))
              ], 64)) : column.key === "action" ? (openBlock(), createBlock(unref(TableAction), {
                key: 2,
                actions: [
                  {
                    label: "增发",
                    ifShow: unref(filterBtnPermission)("redeemCode", "redeemCode.issue"),
                    disabled: unref(isRedeemCodeIssueDisabled)(record),
                    onClick: () => openIssue(record)
                  },
                  {
                    label: "查看",
                    ifShow: unref(filterBtnPermission)("redeemCode", "redeemCode.view"),
                    onClick: () => openViewRedeemCode(record)
                  },
                  {
                    label: "详情",
                    ifShow: unref(filterBtnPermission)("redeemCode", "redeemCode.detail"),
                    onClick: () => unref(openAddModal)(true, { mode: "detail", record: toRaw(record) })
                  },
                  {
                    label: "复制",
                    ifShow: unref(filterBtnPermission)("redeemCode", "redeemCode.copy"),
                    onClick: () => openCopyConfirm(toRaw(record))
                  },
                  {
                    label: "删除",
                    ifShow: unref(filterBtnPermission)("redeemCode", "redeemCode.delete"),
                    color: "error",
                    onClick: () => openDeleteConfirm(toRaw(record))
                  }
                ]
              }, null, 8, ["actions"])) : createCommentVNode("", true)
            ];
          }),
          _: 1
        }, 8, ["onRegister"]),
        createVNode(_sfc_main$1, { onRegister: unref(viewRedeemCodeRegister) }, null, 8, ["onRegister"]),
        createVNode(ImageTextConfigModal, {
          onRegister: unref(imageTextConfigRegister),
          onSuccess: unref(reload)
        }, null, 8, ["onRegister", "onSuccess"]),
        createVNode(AddModal, {
          onRegister: unref(addRegister),
          onSuccess: unref(reload)
        }, null, 8, ["onRegister", "onSuccess"]),
        createVNode(_sfc_main$2, {
          onRegister: unref(issueRegister),
          onSuccess: unref(reload)
        }, null, 8, ["onRegister", "onSuccess"])
      ]);
    };
  }
}));
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-53c89ed6"]]);
export {
  index as default
};
