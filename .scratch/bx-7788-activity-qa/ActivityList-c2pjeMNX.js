var __defProp = Object.defineProperty;
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
import "./index-B2HbZhjI.js";
import "./TableImg.vue_vue_type_style_index_0_lang-HDmD9Lvw.js";
import { u as useTable } from "./useTable-DdsNt3eg.js";
import "./index-CwJ7Rm6V.js";
import { d as defineComponent, a4 as onMounted, q as resolveComponent, s as openBlock, t as createElementBlock, i as createVNode, C as withCtx, v as createBlock, G as Fragment, f as unref, mJ as EyeOutlined, x as createCommentVNode, ev as EditOutlined, mK as SendOutlined, mL as PlayCircleOutlined, mM as PoweroffOutlined, mN as CloseCircleOutlined, y as createTextVNode, aS as h, bO as useMessage, o as _export_sfc } from "./index-qnpxwRIS.js";
import { h as sitePromoConfigPage, i as sitePromoConfigModifyStatus, j as sitePromoConfigRemove } from "./index-56o4V3NE.js";
import { s as searchFormSchema, f as columns, g as loadCategoryFilterOptions } from "./table.data-DLowz5YN.js";
import { _ as _sfc_main$1 } from "./CategoryModal.vue_vue_type_script_setup_true_lang-CZzGIwaU.js";
import { _ as _sfc_main$2 } from "./ActivityConfigModal.vue_vue_type_script_setup_true_lang-4vwziEZA.js";
import { u as useModal } from "./useModal-CYU1mrTZ.js";
import "./useForm-Cg-QMwDR.js";
import "./BasicForm.vue_vue_type_style_index_0_lang-eHbP9IiC.js";
import "./index-B6yns6cu.js";
import "./index-CAMgkY6W.js";
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
import "./index-C1NQKYI1.js";
import "./RescueConfigForm-DX2szLKD.js";
import "./LogoStyleField-Cg0jrv9i.js";
import "./BgStyleField-BWvJoGUz.js";
import "./StyleImageUpload-BmKu3scz.js";
import "./PlatformGameSelector-6JqgTThp.js";
import "./joinLevels-BI5sYC2M.js";
import "./prunePayload-yDlVuarx.js";
import "./SignConfigForm-BLtqDa8n.js";
import "./RewardAmountModal.vue_vue_type_script_setup_true_lang-DRIq3pj-.js";
import "./RegisterGiftConfigForm-BojarQgz.js";
import "./MysteryFundConfigForm-Dg4xqpf5.js";
import "./DepositGiftConfigForm-DPW7IJkz.js";
import "./index-Bx-rF8eu.js";
import "./upload-C_i8kVeq.js";
import "./MemberAppreciationConfigForm-C53h3VrZ.js";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "ActivityList",
  props: {
    siteId: {},
    merchantNo: {}
  },
  setup(__props) {
    const props = __props;
    const { createMessage, createConfirm } = useMessage();
    const [registerCategoryModal, { openModal: openCategoryModal }] = useModal();
    const [registerConfigModal, { openModal: openConfigModal }] = useModal();
    const [registerTable, { reload }] = useTable({
      api: sitePromoConfigPage,
      // 活动分类选「综合」（value=''）时不传分类参数
      beforeFetch: (params) => {
        if (params.sitePromoCategoryId === "") delete params.sitePromoCategoryId;
        return params;
      },
      columns,
      formConfig: {
        labelWidth: 80,
        schemas: searchFormSchema,
        baseColProps: { xl: 6, xxl: 6 }
      },
      striped: true,
      useSearchForm: true,
      showTableSetting: true,
      bordered: true,
      canResize: false,
      showIndexColumn: true,
      rowKey: "id",
      scroll: { x: 1600 }
    });
    onMounted(() => {
      loadCategoryFilterOptions();
    });
    function onCategorySaved() {
      return __async(this, null, function* () {
        loadCategoryFilterOptions();
        yield reload();
      });
    }
    function isTop(record) {
      return Number(record == null ? void 0 : record.isTop) === 1;
    }
    const actionMatrix = {
      Create: ["view", "edit", "delete", "publish"],
      // 草稿
      Release: ["edit", "close", "delete"],
      // 待生效
      Timing: ["view", "edit", "close"],
      // 进行中
      End: ["close"],
      // 已结束
      Remove: ["view", "edit", "enable"]
      // 已关闭
    };
    function canShow(record, action) {
      return (actionMatrix[record == null ? void 0 : record.status] || []).includes(action);
    }
    function handleCreate() {
      openConfigModal(true, { mode: "create" });
    }
    function handleCategorySetting() {
      openCategoryModal(true, { siteId: props.siteId });
    }
    function handleView(record) {
      openConfigModal(true, { mode: "view", record: __spreadValues({}, record) });
    }
    function handleEdit(record) {
      openConfigModal(true, { mode: "edit", record: __spreadValues({}, record) });
    }
    function handleToggleTop(record, checked) {
      return __async(this, null, function* () {
        yield sitePromoConfigModifyStatus({ id: record.id, isTop: checked ? 1 : 0 });
        createMessage.success(checked ? "已置顶" : "已取消置顶");
        yield reload();
      });
    }
    function handlePublish(record) {
      createConfirm({
        iconType: "info",
        title: () => "温馨提示",
        content: () => "确定发布这个活动吗？",
        onOk: () => __async(this, null, function* () {
          yield sitePromoConfigModifyStatus({ id: record.id, status: "Release" });
          createMessage.success("发布成功");
          yield reload();
        })
      });
    }
    function handleEnable(record) {
      createConfirm({
        iconType: "info",
        title: () => "温馨提示",
        content: () => "确定开启这个活动吗？",
        onOk: () => __async(this, null, function* () {
          yield sitePromoConfigModifyStatus({ id: record.id, status: "Release" });
          createMessage.success("开启成功");
          yield reload();
        })
      });
    }
    function handleClose(record) {
      createConfirm({
        iconType: "info",
        title: () => "温馨提示",
        content: () => h("div", null, [
          h("p", null, "确认是否要关闭该活动？"),
          h("p", { style: { color: "#ff4d4f" } }, "注：强制关闭后会员所有未领取奖励全部作废")
        ]),
        onOk: () => __async(this, null, function* () {
          yield sitePromoConfigModifyStatus({ id: record.id, status: "Remove" });
          createMessage.success("关闭成功");
          yield reload();
        })
      });
    }
    function handleDelete(record) {
      createConfirm({
        iconType: "info",
        title: () => "温馨提示",
        content: () => "确定删除这个活动吗？",
        onOk: () => __async(this, null, function* () {
          yield sitePromoConfigRemove(record.id);
          createMessage.success("删除成功");
          yield reload();
        })
      });
    }
    return (_ctx, _cache) => {
      const _component_a_button = resolveComponent("a-button");
      const _component_a_switch = resolveComponent("a-switch");
      const _component_a_tooltip = resolveComponent("a-tooltip");
      return openBlock(), createElementBlock("div", null, [
        createVNode(unref(BasicTable), { onRegister: unref(registerTable) }, {
          toolbar: withCtx(() => [
            createVNode(_component_a_button, {
              type: "primary",
              onClick: handleCreate
            }, {
              default: withCtx(() => [..._cache[0] || (_cache[0] = [
                createTextVNode("新增", -1)
              ])]),
              _: 1
            }),
            createVNode(_component_a_button, {
              type: "primary",
              onClick: handleCategorySetting
            }, {
              default: withCtx(() => [..._cache[1] || (_cache[1] = [
                createTextVNode("分类设置", -1)
              ])]),
              _: 1
            })
          ]),
          bodyCell: withCtx(({ column, record }) => [
            column.key === "isTop" ? (openBlock(), createBlock(_component_a_switch, {
              key: 0,
              checked: isTop(record),
              "checked-children": "开启",
              "un-checked-children": "关闭",
              onChange: (checked) => handleToggleTop(record, checked)
            }, null, 8, ["checked", "onChange"])) : column.key === "action" ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [
              canShow(record, "view") ? (openBlock(), createBlock(_component_a_tooltip, {
                key: 0,
                title: "查看活动"
              }, {
                default: withCtx(() => [
                  createVNode(unref(EyeOutlined), {
                    class: "op-icon op-blue",
                    onClick: ($event) => handleView(record)
                  }, null, 8, ["onClick"])
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true),
              canShow(record, "edit") ? (openBlock(), createBlock(_component_a_tooltip, {
                key: 1,
                title: "修改活动"
              }, {
                default: withCtx(() => [
                  createVNode(unref(EditOutlined), {
                    class: "op-icon op-blue",
                    onClick: ($event) => handleEdit(record)
                  }, null, 8, ["onClick"])
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true),
              canShow(record, "publish") ? (openBlock(), createBlock(_component_a_tooltip, {
                key: 2,
                title: "发布活动"
              }, {
                default: withCtx(() => [
                  createVNode(unref(SendOutlined), {
                    class: "op-icon op-blue",
                    onClick: ($event) => handlePublish(record)
                  }, null, 8, ["onClick"])
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true),
              canShow(record, "enable") ? (openBlock(), createBlock(_component_a_tooltip, {
                key: 3,
                title: "开启活动"
              }, {
                default: withCtx(() => [
                  createVNode(unref(PlayCircleOutlined), {
                    class: "op-icon op-green",
                    onClick: ($event) => handleEnable(record)
                  }, null, 8, ["onClick"])
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true),
              canShow(record, "close") ? (openBlock(), createBlock(_component_a_tooltip, {
                key: 4,
                title: "关闭活动"
              }, {
                default: withCtx(() => [
                  createVNode(unref(PoweroffOutlined), {
                    class: "op-icon op-red",
                    onClick: ($event) => handleClose(record)
                  }, null, 8, ["onClick"])
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true),
              canShow(record, "delete") ? (openBlock(), createBlock(_component_a_tooltip, {
                key: 5,
                title: "删除活动"
              }, {
                default: withCtx(() => [
                  createVNode(unref(CloseCircleOutlined), {
                    class: "op-icon op-red",
                    onClick: ($event) => handleDelete(record)
                  }, null, 8, ["onClick"])
                ]),
                _: 2
              }, 1024)) : createCommentVNode("", true)
            ], 64)) : createCommentVNode("", true)
          ]),
          _: 1
        }, 8, ["onRegister"]),
        createVNode(_sfc_main$1, {
          onRegister: unref(registerCategoryModal),
          onSuccess: onCategorySaved
        }, null, 8, ["onRegister"]),
        createVNode(_sfc_main$2, {
          onRegister: unref(registerConfigModal),
          onSuccess: unref(reload)
        }, null, 8, ["onRegister", "onSuccess"])
      ]);
    };
  }
});
const ActivityList = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-b04d792f"]]);
export {
  ActivityList as default
};
