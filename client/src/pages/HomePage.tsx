import { useState } from "react";
import { Link } from "react-router-dom";
import { PostList } from "../components/PostList";
import { usePosts } from "../hooks/useApi";

const labels: Record<string, string> = { ALL: "전체", NOTICE: "공지", SONGSEOL: "송설글", FREE: "자유게시판", QUESTION: "질문게시판", STUDY: "공부게시판", SCHOOL: "학교생활", CLUB: "동아리", CAREER: "진로", INFO: "정보게시판", SUGGESTION: "건의게시판" };

export function HomePage() {
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const result = usePosts({ page, sort, search: search || undefined, category: category === "ALL" ? undefined : category });
  const { status, data, error } = result as any;
  const posts = (data as any)?.posts || [];
  const pagination = (data as any)?.pagination || {};
  const categoryCounts = posts.reduce((acc: Record<string, number>, post: any) => {
    const key = post.isNotice ? "NOTICE" : post.category;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid lg:grid-cols-[210px_minmax(0,1fr)] gap-6 lg:gap-10">
          <aside className="hidden lg:flex flex-col border-r border-primary-100 pr-6">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-primary-600 uppercase mb-4">GIMCHEON HIGH</p>
            <nav className="space-y-1">
              {[["ALL", "홈"], ["NOTICE", "공지"], ["FREE", "자유게시판"], ["QUESTION", "질문게시판"], ["STUDY", "공부게시판"]].map(([value, text]) => (
                <button key={value} type="button" onClick={() => { setCategory(category === value ? "ALL" : value); setPage(1); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${category === value ? "bg-primary-700 text-white shadow-sm" : "text-gray-600 hover:bg-primary-50 hover:text-primary-800"}`}>
                  {text}
                </button>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl bg-primary-50 border border-primary-100 p-4">
              <img src="/school-logo.webp" alt="" className="w-10 h-10 object-contain mb-3" />
              <p className="font-semibold text-primary-900 text-sm">우리 학교, 우리 이야기</p>
              <p className="text-xs leading-5 text-primary-700 mt-1">서로의 하루를 존중하는 공간이에요.</p>
            </div>
          </aside>

          <main className="min-w-0">
            <section className="relative overflow-hidden rounded-[28px] bg-primary-800 px-6 py-8 sm:px-9 sm:py-10 text-white mb-8">
              <div className="relative z-10 max-w-xl">
                <p className="text-xs font-semibold tracking-[0.24em] text-primary-200 mb-4">GIMCHEON HIGH / COMMUNITY</p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">오늘의 김천고,<br /><span className="text-primary-200">여기서 먼저 만나요.</span></h1>
                <p className="mt-4 text-sm sm:text-base leading-7 text-primary-100">수업 사이 잠깐, 집에 가기 전 한 번 더.<br />우리 학교의 하루를 편하게 나눠요.</p>
                <Link to="/write" className="inline-flex items-center mt-6 px-5 py-3 rounded-full bg-white text-primary-800 text-sm font-semibold hover:bg-primary-50 transition-colors">새 이야기 남기기 <span className="ml-2">→</span></Link>
              </div>
              <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full border-[26px] border-primary-700/70" />
              <div className="absolute -right-10 -bottom-28 w-52 h-52 rounded-full border-[22px] border-primary-600/50" />
            </section>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_270px] gap-8 items-start">
              <section className="min-w-0 order-2 lg:order-1">
                <div className="flex items-end justify-between mb-4">
                  <div><p className="text-[11px] font-semibold tracking-[0.2em] text-primary-600">RIGHT NOW</p><h2 className="text-xl font-bold text-gray-900 mt-1">방금 올라온 이야기</h2></div>
                  <span className="text-xs text-primary-700">{labels[category]}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="text" placeholder="게시글 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} onKeyDown={(e) => e.key === "Enter" && setPage(1)} className="w-full pl-10 pr-4 py-2.5 border border-primary-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" />
                  </div>
                  <select value={sort} onChange={(e) => { setSort(e.target.value as "latest" | "popular"); setPage(1); }} className="px-4 py-2.5 border border-primary-100 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"><option value="latest">최신순</option><option value="popular">인기순</option></select>
                </div>

                {status === "loading" && <PostList posts={[]} loading emptyMessage="게시글을 불러오는 중..." />}
                {status === "success" && <><PostList posts={posts} emptyMessage={search ? "검색 결과가 없습니다." : "게시글이 없습니다."} />{pagination.totalPages !== undefined && pagination.totalPages > 1 && <div className="flex justify-center gap-2 mt-8">{Array.from({ length: pagination.totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 2).reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push(<span key={`ellipsis-${p}`} className="px-2 text-gray-400">...</span>); acc.push(<button key={p} onClick={() => setPage(p)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-primary-100 text-primary-700" : "bg-white border border-primary-100 text-gray-600 hover:bg-primary-50"}`}>{p}</button>); return acc; }, [] as React.ReactNode[])}{page < pagination.totalPages && <button onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-primary-100 text-gray-600 hover:bg-primary-50">다음</button>}</div>}</>}
                {status === "error" && <div className="text-center py-16"><h3 className="text-lg font-medium text-red-600 mb-2">데이터를 불러오지 못했습니다.</h3><p className="text-sm text-red-500 mb-4">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">다시 시도하기</button></div>}
              </section>

              <aside className="block order-1 lg:order-2 rounded-2xl border border-primary-100 bg-white p-5 lg:sticky lg:top-24">
                <div className="flex items-center justify-between mb-4"><div><p className="text-[11px] font-semibold tracking-[0.18em] text-primary-600">BOARDS</p><h2 className="font-bold text-gray-900 mt-1">게시판</h2></div><span className="text-primary-600">⌁</span></div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-1">{["NOTICE", "FREE", "QUESTION", "STUDY", "SCHOOL", "CLUB", "CAREER", "INFO", "SUGGESTION"].map((value) => <button key={value} type="button" onClick={() => { setCategory(category === value ? "ALL" : value); setPage(1); }} className={`w-full text-left rounded-xl border p-3 transition-colors group ${category === value ? "border-primary-300 bg-primary-50" : "border-transparent hover:border-primary-100 hover:bg-primary-50/60"}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-gray-800 group-hover:text-primary-700">{labels[value]}</span><span className="text-xs font-semibold text-primary-700">{value === "NOTICE" ? categoryCounts.NOTICE || 0 : categoryCounts[value] || 0}</span></div><p className="text-[11px] leading-4 text-gray-400 mt-1">{value === "NOTICE" ? "학교의 중요한 소식" : value === "FREE" ? "학교생활부터 일상까지" : value === "QUESTION" ? "궁금한 점을 함께 나눠요" : value === "STUDY" ? "공부법과 자료를 나눠요" : value === "SCHOOL" ? "우리 학교 소식과 생활" : value === "CLUB" ? "동아리 활동을 공유해요" : value === "CAREER" ? "진로 이야기를 나눠요" : value === "INFO" ? "유용한 정보를 모아요" : "더 좋은 학교를 만들어요"}</p></button>)}</div>
                <div className="mt-3 rounded-2xl border border-primary-200 bg-primary-50 p-4"><button type="button" onClick={() => { setCategory(category === "SONGSEOL" ? "ALL" : "SONGSEOL"); setPage(1); }} className="w-full text-left"><div className="flex items-center justify-between"><span className="text-sm font-bold text-primary-900">송설글</span><span className="text-xs font-semibold text-primary-700">추천글</span></div><p className="text-[11px] leading-4 text-primary-700 mt-1">개념있는 송설인들의 글</p><span className="inline-block mt-3 text-xs font-semibold text-primary-700">{category === "SONGSEOL" ? "현재 보고 있어요" : "송설글 보러가기 →"}</span></button></div>
              </aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
