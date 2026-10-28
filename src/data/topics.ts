/** Topic keys used in data/vocab/*.csv, in the order units are presented (concrete and easy first). */
export const TOPICS = [
  { key: 'fam', title: 'Gia đình & con người' },
  { key: 'body', title: 'Cơ thể & sức khỏe' },
  { key: 'food', title: 'Đồ ăn & thức uống' },
  { key: 'home', title: 'Nhà cửa & đồ dùng' },
  { key: 'cloth', title: 'Quần áo & mua sắm' },
  { key: 'nat', title: 'Thiên nhiên & động vật' },
  { key: 'wthr', title: 'Thời tiết & màu sắc' },
  { key: 'time', title: 'Thời gian & số đếm' },
  { key: 'place', title: 'Địa điểm & thành phố' },
  { key: 'trav', title: 'Du lịch & giao thông' },
  { key: 'work', title: 'Trường học & công việc' },
  { key: 'fun', title: 'Giải trí & thể thao' },
  { key: 'feel', title: 'Cảm xúc' },
  { key: 'verb', title: 'Động từ thường gặp' },
  { key: 'adj', title: 'Tính từ thường gặp' },
  { key: 'func', title: 'Từ nối & từ chức năng' },
  { key: 'misc', title: 'Từ vựng chung' },
] as const

export const TOPIC_TITLE: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.title]))
