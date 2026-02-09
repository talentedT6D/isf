-- ============================================================
-- AIFilms V3 Migration - Database-Driven Reels
-- Populates reels table with all 50 reels, per-category numbering
-- Run this in Supabase SQL Editor
-- ============================================================

-- Upsert all 50 reels with correct V2 categories, R2 URLs, per-category numbering (1-10)
INSERT INTO reels (id, reel_number, contestant_name, category, video_url, thumbnail_icon, duration_seconds)
VALUES
  -- Comedy (reel_number 1-10 within category)
  ('reel-1',  1, 'Arjun Mehta',    'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-01.mp4', 'user', 45),
  ('reel-2',  2, 'Priya Sharma',   'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-02.mp4', 'user', 30),
  ('reel-3',  3, 'Rahul Verma',    'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-03.mp4', 'user', 60),
  ('reel-4',  4, 'Ananya Patel',   'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-04.mp4', 'user', 40),
  ('reel-5',  5, 'Vikram Singh',   'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-05.mp4', 'user', 55),
  ('reel-6',  6, 'Neha Gupta',     'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-06.mp4', 'user', 35),
  ('reel-7',  7, 'Aditya Kumar',   'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-07.mp4', 'user', 50),
  ('reel-8',  8, 'Kavya Nair',     'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-08.mp4', 'user', 45),
  ('reel-9',  9, 'Rohan Joshi',    'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-09.mp4', 'user', 40),
  ('reel-10', 10, 'Simran Kaur',   'Comedy', 'https://pub-80916ecd31064b1bb21b62cf3490e8a3.r2.dev/reel-10.mp4', 'user', 60),

  -- Food Porn (reel_number 1-10 within category)
  ('reel-11', 1, 'Ishaan Reddy',   'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/001483eaa7f043918ffe4811cb34245a/1080p-wm-video-CL.mp4', 'user', 48),
  ('reel-12', 2, 'Zara Khan',      'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/001a4bfaa99e461f921130cc8b00fcae/1080p-wm-video-CL.mp4', 'user', 42),
  ('reel-13', 3, 'Dev Malhotra',   'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/002807868ae9477af1532f96e9cabe2e/1080p-wm-video-CL.mp4', 'user', 35),
  ('reel-14', 4, 'Meera Iyer',     'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/002f141e0cd2430fbd2a68aec2a3f6cf/1080p-wm-video-CL.mp4', 'user', 52),
  ('reel-15', 5, 'Karan Bhatia',   'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00343c0b15f64f6ea0b60bb19171c6da/1080p-wm-video-CL.mp4', 'user', 55),
  ('reel-16', 6, 'Aarti Desai',    'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0037ff833b244a698c3a934360ff9435/1080p-wm-video-CL.mp4', 'user', 44),
  ('reel-17', 7, 'Siddharth Roy',  'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/003b80d47ac243339ecf06f16ce83873/1080p-wm-video-CL.mp4', 'user', 38),
  ('reel-18', 8, 'Riya Pillai',    'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/003de8ff03fa49c9bb1134a624550611/1080p-wm-video-CL.mp4', 'user', 50),
  ('reel-19', 9, 'Aryan Chopra',   'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00478621458e450dad378a7fff31caab/1080p-wm-video-CL.mp4', 'user', 46),
  ('reel-20', 10, 'Diya Menon',    'Food Porn', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00515a748d9e4187ad90a1f40a607612/1080p-wm-video-CL.mp4', 'user', 43),

  -- Edits (reel_number 1-10 within category)
  ('reel-21', 1, 'Tanvi Agarwal',  'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/005ac45866c44ec3ce03f35459838ca2/1080p-wm-video-CL.mp4', 'user', 32),
  ('reel-22', 2, 'Nikhil Shetty',  'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/005de4c65053498ba2c366f21cdd4fb8/1080p-wm-video-CL.mp4', 'user', 58),
  ('reel-23', 3, 'Pooja Bajaj',    'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0060066fef9c4a33a80446e7a35d156e/1080p-wm-video-CL.mp4', 'user', 51),
  ('reel-24', 4, 'Yash Thakur',    'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00650abe434647bfa7d9037d94d728fb/1080p-wm-video-CL.mp4', 'user', 47),
  ('reel-25', 5, 'Sneha Rao',      'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0065538c460d465d932c479932ead525/1080p-wm-video-CL.mp4', 'user', 36),
  ('reel-26', 6, 'Kabir Ahuja',    'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0065da11911a446e9eaab2f71f38efa3/1080p-wm-video-CL.mp4', 'user', 54),
  ('reel-27', 7, 'Naina Sen',      'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0067f57b831246cf8002f40314ebb527/1080p-wm-video-CL.mp4', 'user', 49),
  ('reel-28', 8, 'Vihaan Saxena',  'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/006e7c46d8ae4a6284333113aa3f9823/1080p-wm-video-CL.mp4', 'user', 41),
  ('reel-29', 9, 'Isha Tiwari',    'Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0070b656be6f47e8eb89bc7b8b5fea6e/1080p-wm-video-CL.mp4', 'user', 34),
  ('reel-30', 10, 'Arnav Kulkarni','Edits', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0071d27658784e12857a8a32d8e1e959/1080p-wm-video-CL.mp4', 'user', 56),

  -- Kidney Touching (reel_number 1-10 within category)
  ('reel-31', 1, 'Tara Jain',      'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/007365495ab840a7bf8806969174c980/1080p-wm-video-CL.mp4', 'user', 53),
  ('reel-32', 2, 'Reyansh Ghosh',  'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0074162915384a35b8260e4e04e4f62c/1080p-wm-video-CL.mp4', 'user', 45),
  ('reel-33', 3, 'Aanya Banerjee', 'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0077de67385f4b439331815d3c919512/1080p-wm-video-CL.mp4', 'user', 37),
  ('reel-34', 4, 'Shaurya Mishra', 'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0077ea9d7ca3424cd84f8ed62b1e4246/1080p-wm-video-CL.mp4', 'user', 59),
  ('reel-35', 5, 'Kiara Das',      'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/007989c13d6d4e8eba0596a9ce88007b/1080p-wm-video-CL.mp4', 'user', 48),
  ('reel-36', 6, 'Advait Pandey',  'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00799d10c272491386d0afcd12e9fecb/1080p-wm-video-CL.mp4', 'user', 46),
  ('reel-37', 7, 'Sara Mathur',    'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/007d7e129cd944cda14a32c825f797fb/1080p-wm-video-CL.mp4', 'user', 33),
  ('reel-38', 8, 'Atharv Shah',    'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/007f3ff9d9f444ac9aa78985bf3b60d0/1080p-wm-video-CL.mp4', 'user', 57),
  ('reel-39', 9, 'Myra Kapoor',    'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/0080550a89884b0aadc5494c0d325949/1080p-wm-video-CL.mp4', 'user', 52),
  ('reel-40', 10, 'Vivaan Dutta',  'Kidney Touching', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/008c4285a9554236bddee67caa9b8d84/1080p-wm-video-CL.mp4', 'user', 44),

  -- AI Slot (reel_number 1-10 within category)
  ('reel-41', 1, 'Anvi Sinha',     'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/009dc616912e401ca1abeff7e831902f/1080p-wm-video-CL.mp4', 'user', 39),
  ('reel-42', 2, 'Dhruv Chatterjee','AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00a25b3c5cac47a4ab009e90988dd1b5/1080p-wm-video-CL.mp4', 'user', 55),
  ('reel-43', 3, 'Navya Arora',    'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00ab7e15748f44ddbab731edba5c7c54/1080p-wm-video-CL.mp4', 'user', 50),
  ('reel-44', 4, 'Aarav Nambiar',  'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00ad202782774cccb7e27f655a1961ea/1080p-wm-video-CL.mp4', 'user', 43),
  ('reel-45', 5, 'Saanvi Goyal',   'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00b24c98f945425f856bb52354b71133/1080p-wm-video-CL.mp4', 'user', 31),
  ('reel-46', 6, 'Rudra Bhatt',    'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00b2830f78a54047a725d5b93db2fbd1/1080p-wm-video-CL.mp4', 'user', 60),
  ('reel-47', 7, 'Shanaya Kohli',  'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00bc5cbde75e467c959fce20a8b8d6d8/1080p-wm-video-CL.mp4', 'user', 47),
  ('reel-48', 8, 'Ayaan Prasad',   'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00c00fd300124d64ebff5833bf2bb673/1080p-wm-video-CL.mp4', 'user', 42),
  ('reel-49', 9, 'Pari Varma',     'AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00c0d0f0d6d84f1f8280e15d420bec73/1080p-wm-video-CL.mp4', 'user', 36),
  ('reel-50', 10, 'Veer Choudhury','AI Slot', 'https://pub-cfac2a567df745d9869da856f2b8f976.r2.dev/videos/00c873b989844010a52c92646cc8011b/1080p-wm-video-CL.mp4', 'user', 53)
ON CONFLICT (id) DO UPDATE SET
  reel_number = EXCLUDED.reel_number,
  contestant_name = EXCLUDED.contestant_name,
  category = EXCLUDED.category,
  video_url = EXCLUDED.video_url,
  thumbnail_icon = EXCLUDED.thumbnail_icon,
  duration_seconds = EXCLUDED.duration_seconds;

-- Verify
SELECT category, COUNT(*) as count, MIN(reel_number) as min_num, MAX(reel_number) as max_num
FROM reels
WHERE is_active = true
GROUP BY category
ORDER BY category;
