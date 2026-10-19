// 简繁转换：词典体积大（约占整包 1/3），只有切到繁体的用户才加载。
// translate 必须保持同步（全 App 到处在渲染里调用），所以这里是
// 「异步装载 + 同步查询」：装载完成前先原样返回简体。
let simplifiedToTraditional: ((text: string) => string) | null = null;
let loading: Promise<void> | null = null;

export function translateToTraditional(text: string): string {
  return simplifiedToTraditional ? simplifiedToTraditional(text) : text;
}

export function loadTraditionalConverter(): Promise<void> {
  loading ??= import("opencc-js")
    .then((OpenCC) => {
      simplifiedToTraditional = OpenCC.Converter({ from: "cn", to: "t" });
    })
    .catch((error) => {
      console.error("Failed to initialize OpenCC converter", error);
      loading = null; // 失败后允许下次重试
    });
  return loading;
}
