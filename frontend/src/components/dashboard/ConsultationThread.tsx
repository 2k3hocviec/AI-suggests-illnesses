import { Bot, ClipboardList, UserCircle } from 'lucide-react';

const messages = [
  {
    type: 'assistant',
    time: '09:41 AM',
    content:
      'Xin chào, tôi là HealthAI Assistant. Bạn hãy mô tả các triệu chứng đang gặp phải để tôi hỗ trợ gợi ý chuyên khoa phù hợp.',
  },
  {
    type: 'user',
    time: '09:43 AM',
    content:
      'Tôi bị đau bụng bên phải, sốt nhẹ và buồn nôn từ tối qua. Tôi nên khám chuyên khoa nào?',
  },
  {
    type: 'insight',
    time: '09:44 AM',
    content:
      'Các triệu chứng đau bụng và buồn nôn thường phù hợp để tham khảo chuyên khoa Tiêu hóa. Sốt nhẹ có thể cần đánh giá thêm nếu kéo dài hoặc tăng nặng.',
    cardTitle: 'Chuyên khoa gợi ý',
    cardValue: 'Tiêu hóa',
  },
  {
    type: 'assistant',
    time: '09:44 AM',
    content:
      'Thông tin này chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ. Nếu đau tăng, sốt cao, nôn nhiều hoặc mệt lả, bạn nên liên hệ cơ sở y tế gần nhất.',
  },
] as const;

export function ConsultationThread() {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {messages.map((message, index) => {
          if (message.type === 'user') {
            return (
              <div key={index} className="flex justify-end gap-5">
              <div className="max-w-[76%]">
                <div className="rounded-bl-xl rounded-tl-xl rounded-tr-xl bg-[#073f87] px-4 py-3.5 text-sm leading-6 text-white shadow-sm lg:text-[15px]">
                  {message.content}
                </div>
                <p className="mt-2 text-right text-xs text-slate-600">
                  {message.time}
                </p>
              </div>
                <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#073b83] shadow-sm ring-1 ring-slate-200 sm:flex">
                  <UserCircle className="h-6 w-6" />
                </div>
              </div>
            );
          }

          const isInsight = message.type === 'insight';

          return (
            <div key={index} className="flex items-start gap-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
                {isInsight ? (
                  <ClipboardList className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div className="max-w-[76%]">
                <div
                  className={
                    isInsight
                      ? 'rounded-xl border border-emerald-700 bg-white px-4 py-3.5 text-sm leading-6 shadow-sm lg:text-[15px]'
                      : 'rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm leading-6 shadow-sm lg:text-[15px]'
                  }
                >
                  <p>{message.content}</p>
                  {isInsight ? (
                    <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-bold text-ink">
                        {message.cardTitle}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        {message.cardValue}
                      </p>
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-600">{message.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
