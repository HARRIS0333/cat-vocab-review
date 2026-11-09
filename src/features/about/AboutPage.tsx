import type { ContentFile } from "../../content/types";
import { Mascot } from "../../ui/Mascot";

type AboutPageProps = {
  content: ContentFile;
};

const TEXTBOOK_DETAIL_BASE = "https://basic.smartedu.cn/tchMaterial/detail";
const HANZI_WRITER_URL = "https://github.com/chanind/hanzi-writer";
const MAKE_ME_A_HANZI_URL = "https://github.com/skishore/makemeahanzi";

function localAssetHref(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, "")}`;
}

function textbookDetailHref(contentId: string): string {
  const query = new URLSearchParams({
    contentType: "assets_document",
    contentId,
    catalogType: "tchMaterial",
    subCatalog: "tchMaterial",
  });
  return `${TEXTBOOK_DETAIL_BASE}?${query.toString()}`;
}

export function AboutPage({ content }: AboutPageProps) {
  return (
    <section className="about-page" aria-labelledby="about-heading">
      <header className="page-heading">
        <div className="brand">
          <Mascot mood="read" />
          <div>
            <p className="eyebrow">小咪学生字</p>
            <h2 id="about-heading">关于与许可</h2>
          </div>
        </div>
        <p>
          <strong>统编版四年级上册</strong>
          {" · "}2022 年课标修订、{content.auditYear} 年审核
        </p>
        <a className="text-link" href="#/">
          返回首页
        </a>
      </header>
      <p id="new-window-note" className="sr-only">
        外部或文档链接将在新窗口打开
      </p>

      <section className="resume-card" aria-labelledby="about-source-heading">
        <h3 id="about-source-heading">教材来源</h3>
        <p>
          教材结构化内容来自国家中小学智慧教育平台，按课目整理为识字表和写字表练习。
          本产品不分发教材扫描页。
        </p>
        <dl>
          <div>
            <dt>平台</dt>
            <dd>
              <a
                href={textbookDetailHref(content.source.contentId)}
                target="_blank"
                rel="noreferrer"
                aria-describedby="new-window-note"
              >
                {content.source.name}
              </a>
            </dd>
          </div>
          <div>
            <dt>版本说明</dt>
            <dd>{content.edition}</dd>
          </div>
          <div>
            <dt>出版社</dt>
            <dd>{content.publisher}</dd>
          </div>
          <div>
            <dt>内容 ID</dt>
            <dd>{content.source.contentId}</dd>
          </div>
        </dl>
        <p>官方详情页可查看教材出版信息、目录和审核版本。</p>
      </section>

      <section className="resume-card" aria-labelledby="about-privacy-heading">
        <h3 id="about-privacy-heading">隐私说明</h3>
        <p>笔迹只在本机内存中处理，不会上传或保存</p>
        <ul>
          <li>无账号、无广告、无统计</li>
          <li>不接入第三方手写识别服务</li>
          <li>首次联网后可离线使用</li>
          <li>不使用教材扫描图</li>
          <li>不提供账号同步</li>
        </ul>
      </section>

      <section className="resume-card" aria-labelledby="about-license-heading">
        <h3 id="about-license-heading">第三方许可</h3>
        <p>
          Hanzi Writer 以 MIT 许可发布；汉字笔顺和轮廓数据来自 Make Me a Hanzi，
          受 Arphic Public License 约束。
        </p>
        <div className="link-row">
          <a
            className="button button-secondary"
            href={localAssetHref("licenses/HanziWriter-MIT.txt")}
            target="_blank"
            rel="noreferrer"
            aria-describedby="new-window-note"
          >
            Hanzi Writer MIT 许可
          </a>
          <a
            className="button button-secondary"
            href={localAssetHref("licenses/ARPHICPL.txt")}
            target="_blank"
            rel="noreferrer"
            aria-describedby="new-window-note"
          >
            Arphic Public License
          </a>
          <a
            className="button button-ghost"
            href={HANZI_WRITER_URL}
            target="_blank"
            rel="noreferrer"
            aria-describedby="new-window-note"
          >
            Hanzi Writer 项目
          </a>
          <a
            className="button button-ghost"
            href={MAKE_ME_A_HANZI_URL}
            target="_blank"
            rel="noreferrer"
            aria-describedby="new-window-note"
          >
            Make Me a Hanzi 字符数据
          </a>
        </div>
        <p>小桃猫和界面 SVG 插画为本项目原创。</p>
      </section>
    </section>
  );
}
