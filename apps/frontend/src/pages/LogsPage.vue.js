import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getLogs, listMeInstances } from "../services/api";
const instances = ref([]);
const selectedId = ref("");
const lines = ref([]);
const search = ref("");
const paused = ref(false);
const { t } = useI18n();
const filtered = computed(() => lines.value.filter((line) => line.toLowerCase().includes(search.value.toLowerCase())));
async function init() {
    instances.value = await listMeInstances();
}
async function loadLogs() {
    if (!selectedId.value || paused.value)
        return;
    const data = await getLogs(selectedId.value);
    lines.value = data.lines;
}
function clearLogs() {
    lines.value = [];
}
function downloadLogs() {
    const blob = new Blob([lines.value.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${selectedId.value || "instance"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}
void init();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-regular fa-file-lines" },
});
(__VLS_ctx.t("logs.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.selectedId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "",
});
(__VLS_ctx.t("logs.instance"));
for (const [i] of __VLS_getVForSourceType((__VLS_ctx.instances))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (i.id),
        value: (i.id),
    });
    (i.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.loadLogs) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-rotate-right" },
});
(__VLS_ctx.t("logs.refresh"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('logs.search')),
});
(__VLS_ctx.search);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.paused = !__VLS_ctx.paused;
        } },
    ...{ class: "secondary" },
});
(__VLS_ctx.paused ? __VLS_ctx.t("logs.resume") : __VLS_ctx.t("logs.pause"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.clearLogs) },
    ...{ class: "secondary" },
});
(__VLS_ctx.t("logs.clear"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.downloadLogs) },
    ...{ class: "secondary" },
});
(__VLS_ctx.t("logs.download"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({
    ...{ class: "logs-box" },
});
(__VLS_ctx.filtered.join('\n'));
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-file-lines']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-rotate-right']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-box']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            instances: instances,
            selectedId: selectedId,
            search: search,
            paused: paused,
            t: t,
            filtered: filtered,
            loadLogs: loadLogs,
            clearLogs: clearLogs,
            downloadLogs: downloadLogs,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
