-- ============================================================================
-- Blobby: update lessons and review questions from the content files
-- ============================================================================
-- What this does: puts the questions from the files into the app. A question
-- already in the app is changed in place (same question, so kids' answers and
-- stars stay linked to it). A question the app does not have yet is added.
-- What it keeps: questions the teacher deleted stay deleted (they are not added
-- back or changed), kids' answers, stars and audio. Plans, weeks and lessons are
-- only added where missing. It only touches wp_ tables. Running it twice is safe
-- (the second run changes nothing).
-- BUT: a question the teacher edited in the app is replaced by the file's version.
-- PART 1 lists those, so you can check first.
-- PART 1 compares the question text (payload) only; a change to only the type or
-- the skill tag is applied by PART 2 without being listed.
--
-- How to use: paste PART 1 into the Supabase SQL editor and run it. Read the
-- rows. If they look right, paste PART 2 and run it.
-- ============================================================================


-- ============================ PART 1: LOOK FIRST ============================
-- Safe to run any time: it only reads, it never changes anything.
-- One list per file: questions in the app whose text is not what the file had
-- before this edit (for example a teacher edit). PART 2 replaces them.
--   app_text  = the whole question as it is in the app now
--   file_text = the whole question as the file had it before (empty if new)
-- No rows means nothing in the app will be lost.

-- Review bank, grade 2: questions in the app that differ from the file before this edit
select v.skill, v.pos as question_position,
       qq.payload::text as app_text, v.base::jsonb::text as file_text
from (values
  ('articles'::text, 1::int, '{"prompt":"Pick the right sentence.","choices":["Mia gave the book to teacher.","Mia gave the book to an teacher.","Mia gave the book to the teacher."],"answer":2}'::text),
  ('articles', 2, '{"prompt":"Pick the right sentence.","choices":["Sam has an orange umbrella.","Sam has a orange umbrella.","Sam has orange umbrella."],"answer":0}'),
  ('articles', 3, '{"prompt":"Which sentence is right?","choices":["We looked at moon last night.","We looked at the moon last night.","We looked at a moon last night."],"answer":1}'),
  ('articles', 4, '{"before":"Leo saw","after":"elephant at the zoo.","choices":["a","an","two"],"answer":1}'),
  ('articles', 5, '{"before":"Mina drew","after":"big tree on her paper.","choices":["a","an","much"],"answer":0}'),
  ('articles', 6, '{"before":"Tom has a cat.","after":"cat is very soft.","choices":["The","An","Many"],"answer":0}'),
  ('articles', 7, '{"words":["Sam","spilled","cup","of","milk."],"wrongIndex":2,"fixes":["a cup","an cup","much cup"],"answer":0}'),
  ('articles', 8, '{"words":["Ben","is","reading","an","funny","book."],"wrongIndex":3,"fixes":["a","two","many"],"answer":0}'),
  ('articles', 9, '{"prompt":"Build the sentence.","tiles":["Sam","found","an","egg","under","his","bed."],"distractors":["a"]}'),
  ('articles', 10, '{"prompt":"Does the word go with a or an?","groups":["a","an"],"items":[{"text":"insect","group":1},{"text":"cake","group":0},{"text":"igloo","group":1},{"text":"horse","group":0},{"text":"octopus","group":1},{"text":"lemon","group":0}]}'),
  ('articles', 11, null),
  ('third-person-s', 1, '{"prompt":"Pick the right sentence.","choices":["She like pizza.","She likes pizza.","She liking pizza."],"answer":1}'),
  ('third-person-s', 2, '{"prompt":"Pick the right sentence.","choices":["My dog sleep on the sofa.","My dog sleeping on the sofa.","My dog sleeps on the sofa."],"answer":2}'),
  ('third-person-s', 3, '{"prompt":"Which sentence is right?","choices":["The girl comes to school by bus.","The girl come to school by bus.","The girl coming to school by bus."],"answer":0}'),
  ('third-person-s', 4, '{"before":"My brother","after":"soccer every Sunday.","choices":["play","plays","playing"],"answer":1}'),
  ('third-person-s', 5, '{"before":"Ben","after":"his teeth every night.","choices":["brush","brushing","brushes"],"answer":2}'),
  ('third-person-s', 6, '{"before":"It","after":"a lot in summer.","choices":["rains","rain","raining"],"answer":0}'),
  ('third-person-s', 7, '{"words":["Tom","always","crash","his","toy","car."],"wrongIndex":2,"fixes":["crashes","crashing","crashs"],"answer":0}'),
  ('third-person-s', 8, '{"words":["She","don''t","come","to","the","park."],"wrongIndex":1,"fixes":["doesn''t","not","do"],"answer":0}'),
  ('third-person-s', 9, '{"prompt":"Build the sentence.","tiles":["Mina","watches","TV","after","dinner."],"distractors":["watch"]}'),
  ('third-person-s', 10, '{"prompt":"Which word goes with They, and which goes with She?","groups":["They","She"],"items":[{"text":"run","group":0},{"text":"runs","group":1},{"text":"eats","group":1},{"text":"eat","group":0},{"text":"goes","group":1},{"text":"go","group":0}]}'),
  ('third-person-s', 11, null),
  ('plurals', 1, '{"prompt":"Pick the right sentence.","choices":["Every students has a desk.","Every student has a desk.","Every student have a desk."],"answer":1}'),
  ('plurals', 2, '{"prompt":"Pick the right sentence.","choices":["Many people are at the park.","Many peoples are at the park.","Many person are at the park."],"answer":0}'),
  ('plurals', 3, '{"prompt":"Which sentence is right?","choices":["Sam has three box.","Sam has three boxs.","Sam has three boxes."],"answer":2}'),
  ('plurals', 4, '{"before":"The","after":"are playing tag.","choices":["child","children","childs"],"answer":1}'),
  ('plurals', 5, '{"before":"My","after":"are cold.","choices":["foot","foots","feet"],"answer":2}'),
  ('plurals', 6, '{"before":"Every","after":"has a name tag.","choices":["kid","kids","kides"],"answer":0}'),
  ('plurals', 7, '{"words":["Mia","saw","4","girl","at","the","pool."],"wrongIndex":3,"fixes":["girls","girles","girl''s"],"answer":0}'),
  ('plurals', 8, '{"words":["Ben","lost","two","tooths."],"wrongIndex":3,"fixes":["teeth.","toothes.","tooth."],"answer":0}'),
  ('plurals', 9, '{"prompt":"Build the sentence.","tiles":["The","children","are","eating","lunch."],"distractors":["childs","is"]}'),
  ('plurals', 10, '{"prompt":"One, or more than one?","groups":["one","more than one"],"items":[{"text":"cat","group":0},{"text":"cats","group":1},{"text":"foot","group":0},{"text":"feet","group":1},{"text":"child","group":0},{"text":"people","group":1}]}'),
  ('plurals', 11, null),
  ('sentence-ends', 1, '{"prompt":"Pick the right sentence.","choices":["my cat is black.","My cat is black.","My cat is black"],"answer":1}'),
  ('sentence-ends', 2, '{"prompt":"Pick the right sentence.","choices":["I went to the park with mia.","I went to the park with Mia.","i went to the park with Mia."],"answer":1}'),
  ('sentence-ends', 3, '{"prompt":"Which one is written the right way?","choices":["We went to the beach. We swam in the sea.","We went to the beach we swam in the sea.","We went to the beach. we swam in the sea."],"answer":0}'),
  ('sentence-ends', 4, '{"before":"My best friend is","after":".","choices":["sam","Sam"],"answer":1}'),
  ('sentence-ends', 5, '{"before":"I like dogs.","after":"are cute.","choices":["They","they"],"answer":0}'),
  ('sentence-ends', 6, '{"before":"Leo has swim class on","after":".","choices":["monday","Monday"],"answer":1}'),
  ('sentence-ends', 7, '{"words":["Tom","and","leo","are","brothers."],"wrongIndex":2,"fixes":["Leo","Leos","leo."],"answer":0}'),
  ('sentence-ends', 8, '{"words":["Mia","ate","a","big","sandwich"],"wrongIndex":4,"fixes":["sandwich.","sandwich,","Sandwich"],"answer":0}'),
  ('sentence-ends', 9, '{"prompt":"Build the sentence.","tiles":["My","sister","lives","in","Busan."],"distractors":["busan."]}'),
  ('sentence-ends', 10, '{"prompt":"Does the word always start with a capital letter?","groups":["always a capital","no capital needed"],"items":[{"text":"monday","group":0},{"text":"tom","group":0},{"text":"korea","group":0},{"text":"apple","group":1},{"text":"school","group":1},{"text":"dog","group":1}]}'),
  ('sentence-ends', 11, null),
  ('past-tense', 1, '{"prompt":"Pick the right sentence.","choices":["Yesterday, Mia spill water on the floor.","Yesterday, Mia spilled water on the floor.","Yesterday, Mia spilling water on the floor."],"answer":1}'),
  ('past-tense', 2, '{"prompt":"Pick the right sentence.","choices":["Last night, Ben eat pizza.","Last night, Ben eated pizza.","Last night, Ben ate pizza."],"answer":2}'),
  ('past-tense', 3, '{"prompt":"Which sentence is right?","choices":["Last summer, we went to the beach.","Last summer, we go to the beach.","Last summer, we goed to the beach."],"answer":0}'),
  ('past-tense', 4, '{"before":"Last week, Sam","after":"his toy car.","choices":["fix","fixed","fixing"],"answer":1}'),
  ('past-tense', 5, '{"before":"Yesterday, my grandma","after":"to my house.","choices":["came","come","comed"],"answer":0}'),
  ('past-tense', 6, '{"before":"Two days ago, Leo","after":"a red crayon to draw a sun.","choices":["use","using","used"],"answer":2}'),
  ('past-tense', 7, '{"words":["Yesterday,","Leo","found","a","cookie","and","eat","it."],"wrongIndex":6,"fixes":["ate","eats","eating"],"answer":0}'),
  ('past-tense', 8, '{"words":["The","boy","picked","up","the","pillow","and","throw","it."],"wrongIndex":7,"fixes":["threw","throws","throwing"],"answer":0}'),
  ('past-tense', 9, '{"prompt":"Build the sentence.","tiles":["Mina","dropped","her","cup","and","cried."],"distractors":["drop"]}'),
  ('past-tense', 10, '{"prompt":"Now, or in the past?","groups":["now","in the past"],"items":[{"text":"run","group":0},{"text":"ran","group":1},{"text":"fix","group":0},{"text":"fixed","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'),
  ('past-tense', 11, null),
  ('be', 1, '{"prompt":"Pick the right sentence.","choices":["The kids is happy.","The kids are happy.","The kids am happy."],"answer":1}'),
  ('be', 2, '{"prompt":"Pick the right sentence.","choices":["There were four adults in the room.","There was four adults in the room.","There were four adult in the room."],"answer":0}'),
  ('be', 3, '{"prompt":"Which sentence is right?","choices":["One cat are on the bed.","One cat were on the bed.","One cat is on the bed."],"answer":2}'),
  ('be', 4, '{"before":"I","after":"eight years old.","choices":["am","is","are"],"answer":0}'),
  ('be', 5, '{"before":"Yesterday, the dogs","after":"very loud.","choices":["was","were","is"],"answer":1}'),
  ('be', 6, '{"before":"Mia and Ben","after":"in my class.","choices":["is","am","are"],"answer":2}'),
  ('be', 7, '{"words":["My","shoes","is","wet."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'),
  ('be', 8, '{"words":["Last","night,","Tom","were","sick."],"wrongIndex":3,"fixes":["was","are","am"],"answer":0}'),
  ('be', 9, '{"prompt":"Build the sentence.","tiles":["The","birds","were","in","the","tree."],"distractors":["was"]}'),
  ('be', 10, '{"prompt":"Which word goes with each one: is or are?","groups":["is","are"],"items":[{"text":"the cat","group":0},{"text":"my friends","group":1},{"text":"Mia","group":0},{"text":"the books","group":1},{"text":"Tom and Sam","group":1},{"text":"my mom","group":0}]}'),
  ('be', 11, null),
  ('because-when', 1, '{"prompt":"Pick the right sentence.","choices":["Mia is happy because her dog is home.","Mia is happy. Because her dog is home.","Because her dog is home."],"answer":0}'),
  ('because-when', 2, '{"prompt":"Pick the right sentence.","choices":["I wear a coat. When it is cold.","I wear a coat when it is cold.","When it is cold."],"answer":1}'),
  ('because-when', 3, '{"prompt":"Which one is written the right way?","choices":["When the bell rang. We went outside.","The bell rang. When we went outside.","When the bell rang, we went outside."],"answer":2}'),
  ('because-when', 4, '{"before":"Sam closed the window","after":"it was cold.","choices":["because","because of","or"],"answer":0}'),
  ('because-when', 5, '{"before":"Tom was sleeping","after":"the phone rang.","choices":["because","when","so"],"answer":1}'),
  ('because-when', 6, '{"before":"It was dark","after":"we got home.","choices":["because","than","when"],"answer":2}'),
  ('because-when', 7, '{"words":["Leo","is","happy","Because","it","is","his","birthday."],"wrongIndex":3,"fixes":["because","so","because."],"answer":0}'),
  ('because-when', 8, '{"words":["I","wear","sunglasses","or","it","is","sunny."],"wrongIndex":3,"fixes":["when","than","of"],"answer":0}'),
  ('because-when', 9, '{"prompt":"Build the sentence.","tiles":["Sam","is","happy","because","it","is","Friday."],"distractors":["Because"]}'),
  ('because-when', 10, '{"prompt":"Is it a full sentence?","groups":["full sentence","not a full sentence"],"items":[{"text":"Because it was hot.","group":1},{"text":"I ran because I was late.","group":0},{"text":"When we got home.","group":1},{"text":"We sang when Mom came home.","group":0},{"text":"Because the dog barked.","group":1},{"text":"We cheered when Sam won.","group":0}]}'),
  ('because-when', 11, null),
  ('compound-comma', 1, '{"prompt":"Pick the right sentence.","choices":["Ben is reading, but Tom is sleeping.","Ben is reading but, Tom is sleeping.","Ben is reading, but, Tom is sleeping."],"answer":0}'),
  ('compound-comma', 2, '{"prompt":"Pick the right sentence.","choices":["It was raining so, we stayed inside.","It was raining, so we stayed inside.","It was raining. so we stayed inside."],"answer":1}'),
  ('compound-comma', 3, '{"prompt":"Which sentence is right?","choices":["Mia likes cats and, Sam likes dogs.","Mia likes cats, Sam likes dogs.","Mia likes cats, and Sam likes dogs."],"answer":2}'),
  ('compound-comma', 4, '{"before":"I was hungry,","after":"I ate a banana.","choices":["so","or","because"],"answer":0}'),
  ('compound-comma', 5, '{"before":"Leo wanted to play,","after":"it was time for bed.","choices":["so","but","because"],"answer":1}'),
  ('compound-comma', 6, '{"before":"Tom has a red ball,","after":"Mia has a blue ball.","choices":["so","because","and"],"answer":2}'),
  ('compound-comma', 7, '{"words":["Sam","was","tired,","so,","he","took","a","nap."],"wrongIndex":3,"fixes":["so","so.","So"],"answer":0}'),
  ('compound-comma', 8, '{"words":["Mina","sang,","Leo","danced."],"wrongIndex":2,"fixes":["and Leo","Leo,","the Leo"],"answer":0}'),
  ('compound-comma', 9, '{"prompt":"Build the sentence.","tiles":["It","was","hot,","so","we","swam."],"distractors":["hot"]}'),
  ('compound-comma', 10, '{"prompt":"Is the comma in the right place?","groups":["yes","no"],"items":[{"text":"The bus was late, so I walked.","group":0},{"text":"I have a cat, but I want a dog.","group":0},{"text":"Mom sang, and Dad played the piano.","group":0},{"text":"The bus was late so, I walked.","group":1},{"text":"I have a cat but, I want a dog.","group":1},{"text":"Mom sang and, Dad played the piano.","group":1}]}'),
  ('compound-comma', 11, null),
  ('ing', 1, '{"prompt":"Pick the right sentence.","choices":["The girl reading a book.","The girl is reading a book.","The girl are reading a book."],"answer":1}'),
  ('ing', 2, '{"prompt":"Pick the right sentence.","choices":["Ben is drinking his juice.","Ben drinking his juice.","Ben is drink his juice."],"answer":0}'),
  ('ing', 3, '{"prompt":"Which sentence is right?","choices":["The boys is running in the park.","The boys running in the park.","The boys are running in the park."],"answer":2}'),
  ('ing', 4, '{"before":"Look! Mia","after":"in the pool.","choices":["is swimming","swimming","is swim"],"answer":0}'),
  ('ing', 5, '{"before":"My parents","after":"cooking dinner.","choices":["is","are","am"],"answer":1}'),
  ('ing', 6, '{"before":"I am","after":"a picture.","choices":["draw","draws","drawing"],"answer":2}'),
  ('ing', 7, '{"words":["The","baby","sleeping","on","the","bed."],"wrongIndex":2,"fixes":["is sleeping","are sleeping","sleep"],"answer":0}'),
  ('ing', 8, '{"words":["We","are","play","tag","outside."],"wrongIndex":2,"fixes":["playing","plays","played"],"answer":0}'),
  ('ing', 9, '{"prompt":"Build the sentence.","tiles":["The","dog","is","chasing","a","ball."],"distractors":["are","chase"]}'),
  ('ing', 10, '{"prompt":"Is the sentence right?","groups":["right","wrong"],"items":[{"text":"She is singing.","group":0},{"text":"They are dancing.","group":0},{"text":"The dogs are barking.","group":0},{"text":"We is laughing.","group":1},{"text":"Mia running.","group":1},{"text":"I are waiting.","group":1}]}'),
  ('ing', 11, null),
  ('prepositions', 1, '{"prompt":"Pick the right sentence.","choices":["The book is in table.","The book is on the table.","The book is at table."],"answer":1}'),
  ('prepositions', 2, '{"prompt":"Pick the right sentence.","choices":["Leo gave the note his mom.","Leo gave the note at his mom.","Leo gave the note to his mom."],"answer":2}'),
  ('prepositions', 3, '{"prompt":"Which sentence is right?","choices":["I go to school every day.","I go at school every day.","I go in school every day."],"answer":0}'),
  ('prepositions', 4, '{"before":"The goldfish swims","after":"its bowl.","choices":["in","at","of"],"answer":0}'),
  ('prepositions', 5, '{"before":"We waited","after":"the bus stop.","choices":["in","at","to"],"answer":1}'),
  ('prepositions', 6, '{"before":"Sam said hello","after":"his friend.","choices":["at","in","to"],"answer":2}'),
  ('prepositions', 7, '{"words":["Tom","put","his","cup","in","the","table."],"wrongIndex":4,"fixes":["on","to","of"],"answer":0}'),
  ('prepositions', 8, '{"words":["Mina","sent","a","letter","her","grandma."],"wrongIndex":4,"fixes":["to her","at her","on her"],"answer":0}'),
  ('prepositions', 9, '{"prompt":"Build the sentence.","tiles":["Mia","goes","to","school","by","bus."],"distractors":["at"]}'),
  ('prepositions', 10, '{"prompt":"Which word goes with each one: on, in, or at?","groups":["on","in","at"],"items":[{"text":"Monday","group":0},{"text":"July","group":1},{"text":"7 o''clock","group":2},{"text":"my birthday","group":0},{"text":"the morning","group":1},{"text":"night","group":2}]}'),
  ('prepositions', 11, null)
) as v(skill, pos, base)
join wp_questions qq on qq.bank_grade = 2 and qq.skill = v.skill and qq.position = v.pos and qq.deleted_at is null
where v.base is null or qq.payload <> v.base::jsonb
order by v.skill, v.pos;


-- ############################################################################
-- ##
-- ##  STOP. Run PART 1 alone first and read the rows. Only then select and run PART 2.
-- ##
-- ############################################################################
-- >>> PART 2 STARTS HERE <<<
-- ============================ PART 2: APPLY ================================
-- Only run this after you checked the rows from PART 1.
-- It runs as one all-or-nothing step: either every change happens, or none.

begin;

-- Review bank, grade 2: 110 questions
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["Nova gave the book to teacher.","Nova gave the book to an teacher.","Nova gave the book to the teacher."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["Nova gave the book to teacher.","Nova gave the book to an teacher.","Nova gave the book to the teacher."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 1, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["Nova gave the book to teacher.","Nova gave the book to an teacher.","Nova gave the book to the teacher."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["Finn has an orange umbrella.","Finn has a orange umbrella.","Finn has orange umbrella."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["Finn has an orange umbrella.","Finn has a orange umbrella.","Finn has orange umbrella."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 2, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["Finn has an orange umbrella.","Finn has a orange umbrella.","Finn has orange umbrella."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["We looked at moon last night.","We looked at the moon last night.","We looked at a moon last night."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["We looked at moon last night.","We looked at the moon last night.","We looked at a moon last night."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 3, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["We looked at moon last night.","We looked at the moon last night.","We looked at a moon last night."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Milo saw","after":"elephant at the zoo.","choices":["a","an","two"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Milo saw","after":"elephant at the zoo.","choices":["a","an","two"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 4, 'fill_blank', '{"before":"Milo saw","after":"elephant at the zoo.","choices":["a","an","two"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Ruby drew","after":"big tree on her paper.","choices":["a","an","much"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Ruby drew","after":"big tree on her paper.","choices":["a","an","much"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 5, 'fill_blank', '{"before":"Ruby drew","after":"big tree on her paper.","choices":["a","an","much"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Theo has a cat.","after":"cat is very soft.","choices":["The","An","Many"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Theo has a cat.","after":"cat is very soft.","choices":["The","An","Many"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 6, 'fill_blank', '{"before":"Theo has a cat.","after":"cat is very soft.","choices":["The","An","Many"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Finn","spilled","cup","of","milk."],"wrongIndex":2,"fixes":["a cup","an cup","much cup"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Finn","spilled","cup","of","milk."],"wrongIndex":2,"fixes":["a cup","an cup","much cup"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 7, 'find_fix', '{"words":["Finn","spilled","cup","of","milk."],"wrongIndex":2,"fixes":["a cup","an cup","much cup"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Otto","is","reading","an","funny","book."],"wrongIndex":3,"fixes":["a","two","many"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Otto","is","reading","an","funny","book."],"wrongIndex":3,"fixes":["a","two","many"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 8, 'find_fix', '{"words":["Otto","is","reading","an","funny","book."],"wrongIndex":3,"fixes":["a","two","many"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["Finn","found","an","egg","under","his","bed."],"distractors":["a"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["Finn","found","an","egg","under","his","bed."],"distractors":["a"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["Finn","found","an","egg","under","his","bed."],"distractors":["a"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Does the word go with a or an?","groups":["a","an"],"items":[{"text":"insect","group":1},{"text":"cake","group":0},{"text":"igloo","group":1},{"text":"horse","group":0},{"text":"octopus","group":1},{"text":"lemon","group":0}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Does the word go with a or an?","groups":["a","an"],"items":[{"text":"insect","group":1},{"text":"cake","group":0},{"text":"igloo","group":1},{"text":"horse","group":0},{"text":"octopus","group":1},{"text":"lemon","group":0}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 10, 'sort_it', '{"prompt":"Does the word go with a or an?","groups":["a","an"],"items":[{"text":"insect","group":1},{"text":"cake","group":0},{"text":"igloo","group":1},{"text":"horse","group":0},{"text":"octopus","group":1},{"text":"lemon","group":0}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 10);
update wp_questions set type = 'odd_one_out', payload = '{"prompt":"Three of these are right. Which one is not?","words":["an old hat","a red apple","an blue kite","an empty box"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'articles' and position = 11 and deleted_at is null and (type <> 'odd_one_out' or payload <> '{"prompt":"Three of these are right. Which one is not?","words":["an old hat","a red apple","an blue kite","an empty box"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'articles', 11, 'odd_one_out', '{"prompt":"Three of these are right. Which one is not?","words":["an old hat","a red apple","an blue kite","an empty box"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'articles' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["She like pizza.","She likes pizza.","She liking pizza."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["She like pizza.","She likes pizza.","She liking pizza."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 1, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["She like pizza.","She likes pizza.","She liking pizza."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["My dog sleep on the sofa.","My dog sleeping on the sofa.","My dog sleeps on the sofa."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["My dog sleep on the sofa.","My dog sleeping on the sofa.","My dog sleeps on the sofa."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 2, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["My dog sleep on the sofa.","My dog sleeping on the sofa.","My dog sleeps on the sofa."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the sentence with no mistakes.","choices":["The girl comes to school by bus.","The girl come to school by bus.","The girl coming to school by bus."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the sentence with no mistakes.","choices":["The girl comes to school by bus.","The girl come to school by bus.","The girl coming to school by bus."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 3, 'pick_one', '{"prompt":"Tap the sentence with no mistakes.","choices":["The girl comes to school by bus.","The girl come to school by bus.","The girl coming to school by bus."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"My brother","after":"soccer every Sunday.","choices":["play","plays","playing"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"My brother","after":"soccer every Sunday.","choices":["play","plays","playing"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 4, 'fill_blank', '{"before":"My brother","after":"soccer every Sunday.","choices":["play","plays","playing"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"The hippo","after":"his teeth every night.","choices":["brush","brushing","brushes"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The hippo","after":"his teeth every night.","choices":["brush","brushing","brushes"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 5, 'fill_blank', '{"before":"The hippo","after":"his teeth every night.","choices":["brush","brushing","brushes"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"It","after":"a lot in summer.","choices":["rains","rain","raining"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"It","after":"a lot in summer.","choices":["rains","rain","raining"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 6, 'fill_blank', '{"before":"It","after":"a lot in summer.","choices":["rains","rain","raining"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Theo","always","crash","his","toy","car."],"wrongIndex":2,"fixes":["crashes","crashing","crashs"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Theo","always","crash","his","toy","car."],"wrongIndex":2,"fixes":["crashes","crashing","crashs"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 7, 'find_fix', '{"words":["Theo","always","crash","his","toy","car."],"wrongIndex":2,"fixes":["crashes","crashing","crashs"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["She","don''t","come","to","the","park."],"wrongIndex":1,"fixes":["doesn''t","not","do"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["She","don''t","come","to","the","park."],"wrongIndex":1,"fixes":["doesn''t","not","do"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 8, 'find_fix', '{"words":["She","don''t","come","to","the","park."],"wrongIndex":1,"fixes":["doesn''t","not","do"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["Ruby","watches","TV","after","dinner."],"distractors":["watch"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["Ruby","watches","TV","after","dinner."],"distractors":["watch"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["Ruby","watches","TV","after","dinner."],"distractors":["watch"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which word goes with They, and which goes with She?","groups":["They","She"],"items":[{"text":"run","group":0},{"text":"runs","group":1},{"text":"eats","group":1},{"text":"eat","group":0},{"text":"goes","group":1},{"text":"go","group":0}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which word goes with They, and which goes with She?","groups":["They","She"],"items":[{"text":"run","group":0},{"text":"runs","group":1},{"text":"eats","group":1},{"text":"eat","group":0},{"text":"goes","group":1},{"text":"go","group":0}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 10, 'sort_it', '{"prompt":"Which word goes with They, and which goes with She?","groups":["They","She"],"items":[{"text":"run","group":0},{"text":"runs","group":1},{"text":"eats","group":1},{"text":"eat","group":0},{"text":"goes","group":1},{"text":"go","group":0}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 10);
update wp_questions set type = 'tap_all', payload = '{"prompt":"Tap every word that needs an s.","words":["Zara","sing","and","Milo","dance","every","day."],"answers":[1,4]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'third-person-s' and position = 11 and deleted_at is null and (type <> 'tap_all' or payload <> '{"prompt":"Tap every word that needs an s.","words":["Zara","sing","and","Milo","dance","every","day."],"answers":[1,4]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'third-person-s', 11, 'tap_all', '{"prompt":"Tap every word that needs an s.","words":["Zara","sing","and","Milo","dance","every","day."],"answers":[1,4]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'third-person-s' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["Every students has a desk.","Every student has a desk.","Every student have a desk."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["Every students has a desk.","Every student has a desk.","Every student have a desk."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 1, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["Every students has a desk.","Every student has a desk.","Every student have a desk."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["Many people are at the park.","Many peoples are at the park.","Many person are at the park."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["Many people are at the park.","Many peoples are at the park.","Many person are at the park."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 2, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["Many people are at the park.","Many peoples are at the park.","Many person are at the park."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["Finn has three box.","Finn has three boxs.","Finn has three boxes."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["Finn has three box.","Finn has three boxs.","Finn has three boxes."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 3, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["Finn has three box.","Finn has three boxs.","Finn has three boxes."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"The","after":"are playing tag.","choices":["child","children","childs"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The","after":"are playing tag.","choices":["child","children","childs"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 4, 'fill_blank', '{"before":"The","after":"are playing tag.","choices":["child","children","childs"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"My","after":"are cold.","choices":["foot","foots","feet"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"My","after":"are cold.","choices":["foot","foots","feet"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 5, 'fill_blank', '{"before":"My","after":"are cold.","choices":["foot","foots","feet"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Every","after":"has a name tag.","choices":["kid","kids","kides"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Every","after":"has a name tag.","choices":["kid","kids","kides"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 6, 'fill_blank', '{"before":"Every","after":"has a name tag.","choices":["kid","kids","kides"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Nova","saw","4","cow","in","the","pool."],"wrongIndex":3,"fixes":["cows","cowes","cow''s"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Nova","saw","4","cow","in","the","pool."],"wrongIndex":3,"fixes":["cows","cowes","cow''s"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 7, 'find_fix', '{"words":["Nova","saw","4","cow","in","the","pool."],"wrongIndex":3,"fixes":["cows","cowes","cow''s"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Otto","lost","two","tooths."],"wrongIndex":3,"fixes":["teeth.","toothes.","tooth."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Otto","lost","two","tooths."],"wrongIndex":3,"fixes":["teeth.","toothes.","tooth."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 8, 'find_fix', '{"words":["Otto","lost","two","tooths."],"wrongIndex":3,"fixes":["teeth.","toothes.","tooth."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Make a sentence from the tiles.","tiles":["The","children","are","eating","lunch."],"distractors":["childs","is"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Make a sentence from the tiles.","tiles":["The","children","are","eating","lunch."],"distractors":["childs","is"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 9, 'build_it', '{"prompt":"Make a sentence from the tiles.","tiles":["The","children","are","eating","lunch."],"distractors":["childs","is"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"One, or more than one?","groups":["one","more than one"],"items":[{"text":"cat","group":0},{"text":"cats","group":1},{"text":"foot","group":0},{"text":"feet","group":1},{"text":"child","group":0},{"text":"people","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"One, or more than one?","groups":["one","more than one"],"items":[{"text":"cat","group":0},{"text":"cats","group":1},{"text":"foot","group":0},{"text":"feet","group":1},{"text":"child","group":0},{"text":"people","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 10, 'sort_it', '{"prompt":"One, or more than one?","groups":["one","more than one"],"items":[{"text":"cat","group":0},{"text":"cats","group":1},{"text":"foot","group":0},{"text":"feet","group":1},{"text":"child","group":0},{"text":"people","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 10);
update wp_questions set type = 'match_pairs', payload = '{"prompt":"Match each word to the word for more than one.","pairs":[{"left":"mouse","right":"mice"},{"left":"man","right":"men"},{"left":"fox","right":"foxes"},{"left":"baby","right":"babies"}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'plurals' and position = 11 and deleted_at is null and (type <> 'match_pairs' or payload <> '{"prompt":"Match each word to the word for more than one.","pairs":[{"left":"mouse","right":"mice"},{"left":"man","right":"men"},{"left":"fox","right":"foxes"},{"left":"baby","right":"babies"}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'plurals', 11, 'match_pairs', '{"prompt":"Match each word to the word for more than one.","pairs":[{"left":"mouse","right":"mice"},{"left":"man","right":"men"},{"left":"fox","right":"foxes"},{"left":"baby","right":"babies"}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'plurals' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one has the capital letters and periods right?","choices":["my cat is black.","My cat is black.","My cat is black"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one has the capital letters and periods right?","choices":["my cat is black.","My cat is black.","My cat is black"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 1, 'pick_one', '{"prompt":"Which one has the capital letters and periods right?","choices":["my cat is black.","My cat is black.","My cat is black"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["I went to the park with nova.","I went to the park with Nova.","i went to the park with Nova."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["I went to the park with nova.","I went to the park with Nova.","i went to the park with Nova."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 2, 'pick_one', '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["I went to the park with nova.","I went to the park with Nova.","i went to the park with Nova."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which sentence starts and ends the right way?","choices":["We went to the beach. We swam in the sea.","We went to the beach we swam in the sea.","We went to the beach. we swam in the sea."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which sentence starts and ends the right way?","choices":["We went to the beach. We swam in the sea.","We went to the beach we swam in the sea.","We went to the beach. we swam in the sea."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 3, 'pick_one', '{"prompt":"Which sentence starts and ends the right way?","choices":["We went to the beach. We swam in the sea.","We went to the beach we swam in the sea.","We went to the beach. we swam in the sea."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"My best friend is","after":".","choices":["finn","Finn"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"My best friend is","after":".","choices":["finn","Finn"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 4, 'fill_blank', '{"before":"My best friend is","after":".","choices":["finn","Finn"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"I like dogs.","after":"are cute.","choices":["They","they"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I like dogs.","after":"are cute.","choices":["They","they"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 5, 'fill_blank', '{"before":"I like dogs.","after":"are cute.","choices":["They","they"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Milo has swim class on","after":".","choices":["monday","Monday"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Milo has swim class on","after":".","choices":["monday","Monday"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 6, 'fill_blank', '{"before":"Milo has swim class on","after":".","choices":["monday","Monday"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Theo","and","milo","are","brothers."],"wrongIndex":2,"fixes":["Milo","Milos","milo."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Theo","and","milo","are","brothers."],"wrongIndex":2,"fixes":["Milo","Milos","milo."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 7, 'find_fix', '{"words":["Theo","and","milo","are","brothers."],"wrongIndex":2,"fixes":["Milo","Milos","milo."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Nova","ate","a","big","sandwich"],"wrongIndex":4,"fixes":["sandwich.","sandwich,","Sandwich"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Nova","ate","a","big","sandwich"],"wrongIndex":4,"fixes":["sandwich.","sandwich,","Sandwich"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 8, 'find_fix', '{"words":["Nova","ate","a","big","sandwich"],"wrongIndex":4,"fixes":["sandwich.","sandwich,","Sandwich"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Tap the tiles in order.","tiles":["My","sister","lives","in","Busan."],"distractors":["busan."]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Tap the tiles in order.","tiles":["My","sister","lives","in","Busan."],"distractors":["busan."]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 9, 'build_it', '{"prompt":"Tap the tiles in order.","tiles":["My","sister","lives","in","Busan."],"distractors":["busan."]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Does the word always start with a capital letter?","groups":["always a capital","no capital needed"],"items":[{"text":"monday","group":0},{"text":"theo","group":0},{"text":"korea","group":0},{"text":"apple","group":1},{"text":"school","group":1},{"text":"dog","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Does the word always start with a capital letter?","groups":["always a capital","no capital needed"],"items":[{"text":"monday","group":0},{"text":"theo","group":0},{"text":"korea","group":0},{"text":"apple","group":1},{"text":"school","group":1},{"text":"dog","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 10, 'sort_it', '{"prompt":"Does the word always start with a capital letter?","groups":["always a capital","no capital needed"],"items":[{"text":"monday","group":0},{"text":"theo","group":0},{"text":"korea","group":0},{"text":"apple","group":1},{"text":"school","group":1},{"text":"dog","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"We went to the zoo on sunday.","right":false}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'sentence-ends' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"We went to the zoo on sunday.","right":false}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'sentence-ends', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"We went to the zoo on sunday.","right":false}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'sentence-ends' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which sentence is right?","choices":["Yesterday, Nova spill water on the floor.","Yesterday, Nova spilled water on the floor.","Yesterday, Nova spilling water on the floor."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which sentence is right?","choices":["Yesterday, Nova spill water on the floor.","Yesterday, Nova spilled water on the floor.","Yesterday, Nova spilling water on the floor."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 1, 'pick_one', '{"prompt":"Which sentence is right?","choices":["Yesterday, Nova spill water on the floor.","Yesterday, Nova spilled water on the floor.","Yesterday, Nova spilling water on the floor."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["Last night, Otto eat pizza.","Last night, Otto eated pizza.","Last night, Otto ate pizza."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["Last night, Otto eat pizza.","Last night, Otto eated pizza.","Last night, Otto ate pizza."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 2, 'pick_one', '{"prompt":"Which one is right?","choices":["Last night, Otto eat pizza.","Last night, Otto eated pizza.","Last night, Otto ate pizza."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["Last summer, we went to the beach.","Last summer, we go to the beach.","Last summer, we goed to the beach."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["Last summer, we went to the beach.","Last summer, we go to the beach.","Last summer, we goed to the beach."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 3, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["Last summer, we went to the beach.","Last summer, we go to the beach.","Last summer, we goed to the beach."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Last week, the frog","after":"his toy car.","choices":["fix","fixed","fixing"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Last week, the frog","after":"his toy car.","choices":["fix","fixed","fixing"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 4, 'fill_blank', '{"before":"Last week, the frog","after":"his toy car.","choices":["fix","fixed","fixing"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Yesterday, my grandma","after":"to my house.","choices":["came","come","comed"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Yesterday, my grandma","after":"to my house.","choices":["came","come","comed"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 5, 'fill_blank', '{"before":"Yesterday, my grandma","after":"to my house.","choices":["came","come","comed"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Two days ago, Milo","after":"a red crayon to draw a sun.","choices":["use","using","used"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Two days ago, Milo","after":"a red crayon to draw a sun.","choices":["use","using","used"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 6, 'fill_blank', '{"before":"Two days ago, Milo","after":"a red crayon to draw a sun.","choices":["use","using","used"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Yesterday,","Milo","found","a","cookie","and","eat","it."],"wrongIndex":6,"fixes":["ate","eats","eating"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Yesterday,","Milo","found","a","cookie","and","eat","it."],"wrongIndex":6,"fixes":["ate","eats","eating"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 7, 'find_fix', '{"words":["Yesterday,","Milo","found","a","cookie","and","eat","it."],"wrongIndex":6,"fixes":["ate","eats","eating"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["The","boy","picked","up","the","pillow","and","throw","it."],"wrongIndex":7,"fixes":["threw","throws","throwing"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["The","boy","picked","up","the","pillow","and","throw","it."],"wrongIndex":7,"fixes":["threw","throws","throwing"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 8, 'find_fix', '{"words":["The","boy","picked","up","the","pillow","and","throw","it."],"wrongIndex":7,"fixes":["threw","throws","throwing"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Tap the tiles in order.","tiles":["Ruby","dropped","her","cup","and","cried."],"distractors":["drop"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Tap the tiles in order.","tiles":["Ruby","dropped","her","cup","and","cried."],"distractors":["drop"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 9, 'build_it', '{"prompt":"Tap the tiles in order.","tiles":["Ruby","dropped","her","cup","and","cried."],"distractors":["drop"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Now, or in the past?","groups":["now","in the past"],"items":[{"text":"run","group":0},{"text":"ran","group":1},{"text":"fix","group":0},{"text":"fixed","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Now, or in the past?","groups":["now","in the past"],"items":[{"text":"run","group":0},{"text":"ran","group":1},{"text":"fix","group":0},{"text":"fixed","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 10, 'sort_it', '{"prompt":"Now, or in the past?","groups":["now","in the past"],"items":[{"text":"run","group":0},{"text":"ran","group":1},{"text":"fix","group":0},{"text":"fixed","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 10);
update wp_questions set type = 'odd_one_out', payload = '{"prompt":"Three of these can finish \"Yesterday, I ...\". Which one cannot?","words":["jumped high","sang a song","swim fast","baked a cake"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'past-tense' and position = 11 and deleted_at is null and (type <> 'odd_one_out' or payload <> '{"prompt":"Three of these can finish \"Yesterday, I ...\". Which one cannot?","words":["jumped high","sang a song","swim fast","baked a cake"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'past-tense', 11, 'odd_one_out', '{"prompt":"Three of these can finish \"Yesterday, I ...\". Which one cannot?","words":["jumped high","sang a song","swim fast","baked a cake"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'past-tense' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["The kids is happy.","The kids are happy.","The kids am happy."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["The kids is happy.","The kids are happy.","The kids am happy."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 1, 'pick_one', '{"prompt":"Which one is right?","choices":["The kids is happy.","The kids are happy.","The kids am happy."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["There were four adults in the room.","There was four adults in the room.","There were four adult in the room."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["There were four adults in the room.","There was four adults in the room.","There were four adult in the room."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 2, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["There were four adults in the room.","There was four adults in the room.","There were four adult in the room."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["One cat are on the bed.","One cat were on the bed.","One cat is on the bed."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["One cat are on the bed.","One cat were on the bed.","One cat is on the bed."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 3, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["One cat are on the bed.","One cat were on the bed.","One cat is on the bed."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"I","after":"eight years old.","choices":["am","is","are"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I","after":"eight years old.","choices":["am","is","are"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 4, 'fill_blank', '{"before":"I","after":"eight years old.","choices":["am","is","are"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Yesterday, the dogs","after":"very loud.","choices":["was","were","is"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Yesterday, the dogs","after":"very loud.","choices":["was","were","is"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 5, 'fill_blank', '{"before":"Yesterday, the dogs","after":"very loud.","choices":["was","were","is"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Nova and Otto","after":"in my class.","choices":["is","am","are"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Nova and Otto","after":"in my class.","choices":["is","am","are"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 6, 'fill_blank', '{"before":"Nova and Otto","after":"in my class.","choices":["is","am","are"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["My","shoes","is","full","of","popcorn."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["My","shoes","is","full","of","popcorn."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 7, 'find_fix', '{"words":["My","shoes","is","full","of","popcorn."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Last","night,","Theo","were","sick."],"wrongIndex":3,"fixes":["was","are","am"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Last","night,","Theo","were","sick."],"wrongIndex":3,"fixes":["was","are","am"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 8, 'find_fix', '{"words":["Last","night,","Theo","were","sick."],"wrongIndex":3,"fixes":["was","are","am"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["The","birds","were","in","the","tree."],"distractors":["was"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["The","birds","were","in","the","tree."],"distractors":["was"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["The","birds","were","in","the","tree."],"distractors":["was"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which word goes with each one: is or are?","groups":["is","are"],"items":[{"text":"the cat","group":0},{"text":"my friends","group":1},{"text":"Nova","group":0},{"text":"the books","group":1},{"text":"Theo and Finn","group":1},{"text":"my mom","group":0}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which word goes with each one: is or are?","groups":["is","are"],"items":[{"text":"the cat","group":0},{"text":"my friends","group":1},{"text":"Nova","group":0},{"text":"the books","group":1},{"text":"Theo and Finn","group":1},{"text":"my mom","group":0}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 10, 'sort_it', '{"prompt":"Which word goes with each one: is or are?","groups":["is","are"],"items":[{"text":"the cat","group":0},{"text":"my friends","group":1},{"text":"Nova","group":0},{"text":"the books","group":1},{"text":"Theo and Finn","group":1},{"text":"my mom","group":0}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 10);
update wp_questions set type = 'match_pairs', payload = '{"prompt":"Match the two parts of each sentence.","pairs":[{"left":"Right now, I","right":"am at the park."},{"left":"Right now, we","right":"are at the park."},{"left":"Yesterday, Grandpa","right":"was at the park."},{"left":"Yesterday, the ducks","right":"were at the park."}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'be' and position = 11 and deleted_at is null and (type <> 'match_pairs' or payload <> '{"prompt":"Match the two parts of each sentence.","pairs":[{"left":"Right now, I","right":"am at the park."},{"left":"Right now, we","right":"are at the park."},{"left":"Yesterday, Grandpa","right":"was at the park."},{"left":"Yesterday, the ducks","right":"were at the park."}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'be', 11, 'match_pairs', '{"prompt":"Match the two parts of each sentence.","pairs":[{"left":"Right now, I","right":"am at the park."},{"left":"Right now, we","right":"are at the park."},{"left":"Yesterday, Grandpa","right":"was at the park."},{"left":"Yesterday, the ducks","right":"were at the park."}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'be' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"One of these is right. Tap it.","choices":["Nova is happy because her dog is home.","Nova is happy. Because her dog is home.","Because her dog is home."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"One of these is right. Tap it.","choices":["Nova is happy because her dog is home.","Nova is happy. Because her dog is home.","Because her dog is home."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 1, 'pick_one', '{"prompt":"One of these is right. Tap it.","choices":["Nova is happy because her dog is home.","Nova is happy. Because her dog is home.","Because her dog is home."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which sentence is right?","choices":["I wear a coat. When it is cold.","I wear a coat when it is cold.","When it is cold."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which sentence is right?","choices":["I wear a coat. When it is cold.","I wear a coat when it is cold.","When it is cold."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 2, 'pick_one', '{"prompt":"Which sentence is right?","choices":["I wear a coat. When it is cold.","I wear a coat when it is cold.","When it is cold."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["When the bell rang. We went outside.","The bell rang. When we went outside.","When the bell rang, we went outside."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["When the bell rang. We went outside.","The bell rang. When we went outside.","When the bell rang, we went outside."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 3, 'pick_one', '{"prompt":"Which one is right?","choices":["When the bell rang. We went outside.","The bell rang. When we went outside.","When the bell rang, we went outside."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Pip wore mittens","after":"it was cold.","choices":["because","because of","or"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Pip wore mittens","after":"it was cold.","choices":["because","because of","or"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 4, 'fill_blank', '{"before":"Pip wore mittens","after":"it was cold.","choices":["because","because of","or"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Theo was sleeping","after":"the phone rang.","choices":["because","when","so"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Theo was sleeping","after":"the phone rang.","choices":["because","when","so"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 5, 'fill_blank', '{"before":"Theo was sleeping","after":"the phone rang.","choices":["because","when","so"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"It was dark","after":"we got home.","choices":["because","than","when"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"It was dark","after":"we got home.","choices":["because","than","when"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 6, 'fill_blank', '{"before":"It was dark","after":"we got home.","choices":["because","than","when"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Milo","is","happy","Because","it","is","his","birthday."],"wrongIndex":3,"fixes":["because","so","because."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Milo","is","happy","Because","it","is","his","birthday."],"wrongIndex":3,"fixes":["because","so","because."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 7, 'find_fix', '{"words":["Milo","is","happy","Because","it","is","his","birthday."],"wrongIndex":3,"fixes":["because","so","because."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["I","wear","sunglasses","or","it","is","sunny."],"wrongIndex":3,"fixes":["when","than","of"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["I","wear","sunglasses","or","it","is","sunny."],"wrongIndex":3,"fixes":["when","than","of"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 8, 'find_fix', '{"words":["I","wear","sunglasses","or","it","is","sunny."],"wrongIndex":3,"fixes":["when","than","of"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Make a sentence from the tiles.","tiles":["Finn","is","happy","because","it","is","Friday."],"distractors":["Because"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Make a sentence from the tiles.","tiles":["Finn","is","happy","because","it","is","Friday."],"distractors":["Because"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 9, 'build_it', '{"prompt":"Make a sentence from the tiles.","tiles":["Finn","is","happy","because","it","is","Friday."],"distractors":["Because"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Is it a full sentence?","groups":["full sentence","not a full sentence"],"items":[{"text":"Because it was hot.","group":1},{"text":"I ran because I was late.","group":0},{"text":"When we got home.","group":1},{"text":"We sang when Mom came home.","group":0},{"text":"Because the dog barked.","group":1},{"text":"We cheered when Finn won.","group":0}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Is it a full sentence?","groups":["full sentence","not a full sentence"],"items":[{"text":"Because it was hot.","group":1},{"text":"I ran because I was late.","group":0},{"text":"When we got home.","group":1},{"text":"We sang when Mom came home.","group":0},{"text":"Because the dog barked.","group":1},{"text":"We cheered when Finn won.","group":0}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 10, 'sort_it', '{"prompt":"Is it a full sentence?","groups":["full sentence","not a full sentence"],"items":[{"text":"Because it was hot.","group":1},{"text":"I ran because I was late.","group":0},{"text":"When we got home.","group":1},{"text":"We sang when Mom came home.","group":0},{"text":"Because the dog barked.","group":1},{"text":"We cheered when Finn won.","group":0}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"Zara was sad because her kite broke.","right":true}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'because-when' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"Zara was sad because her kite broke.","right":true}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'because-when', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"Zara was sad because her kite broke.","right":true}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'because-when' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["Otto is reading, but Theo is sleeping.","Otto is reading but, Theo is sleeping.","Otto is reading, but, Theo is sleeping."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["Otto is reading, but Theo is sleeping.","Otto is reading but, Theo is sleeping.","Otto is reading, but, Theo is sleeping."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 1, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["Otto is reading, but Theo is sleeping.","Otto is reading but, Theo is sleeping.","Otto is reading, but, Theo is sleeping."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the sentence with no mistakes.","choices":["It was raining so, we stayed inside.","It was raining, so we stayed inside.","It was raining. so we stayed inside."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the sentence with no mistakes.","choices":["It was raining so, we stayed inside.","It was raining, so we stayed inside.","It was raining. so we stayed inside."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 2, 'pick_one', '{"prompt":"Tap the sentence with no mistakes.","choices":["It was raining so, we stayed inside.","It was raining, so we stayed inside.","It was raining. so we stayed inside."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"One of these is right. Tap it.","choices":["Nova likes cats and, Finn likes dogs.","Nova likes cats, Finn likes dogs.","Nova likes cats, and Finn likes dogs."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"One of these is right. Tap it.","choices":["Nova likes cats and, Finn likes dogs.","Nova likes cats, Finn likes dogs.","Nova likes cats, and Finn likes dogs."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 3, 'pick_one', '{"prompt":"One of these is right. Tap it.","choices":["Nova likes cats and, Finn likes dogs.","Nova likes cats, Finn likes dogs.","Nova likes cats, and Finn likes dogs."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"I was hungry,","after":"I ate a banana.","choices":["so","or","because"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I was hungry,","after":"I ate a banana.","choices":["so","or","because"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 4, 'fill_blank', '{"before":"I was hungry,","after":"I ate a banana.","choices":["so","or","because"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Milo wanted to play,","after":"it was time for bed.","choices":["so","but","because"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Milo wanted to play,","after":"it was time for bed.","choices":["so","but","because"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 5, 'fill_blank', '{"before":"Milo wanted to play,","after":"it was time for bed.","choices":["so","but","because"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Theo has a red ball,","after":"Nova has a blue ball.","choices":["so","because","and"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Theo has a red ball,","after":"Nova has a blue ball.","choices":["so","because","and"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 6, 'fill_blank', '{"before":"Theo has a red ball,","after":"Nova has a blue ball.","choices":["so","because","and"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Finn","was","tired,","so,","he","took","a","nap."],"wrongIndex":3,"fixes":["so","so.","So"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Finn","was","tired,","so,","he","took","a","nap."],"wrongIndex":3,"fixes":["so","so.","So"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 7, 'find_fix', '{"words":["Finn","was","tired,","so,","he","took","a","nap."],"wrongIndex":3,"fixes":["so","so.","So"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Ruby","sang,","Milo","danced."],"wrongIndex":2,"fixes":["and Milo","Milo,","the Milo"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Ruby","sang,","Milo","danced."],"wrongIndex":2,"fixes":["and Milo","Milo,","the Milo"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 8, 'find_fix', '{"words":["Ruby","sang,","Milo","danced."],"wrongIndex":2,"fixes":["and Milo","Milo,","the Milo"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"What does this say? Put it in order.","tiles":["It","was","hot,","so","we","swam."],"distractors":["hot"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"What does this say? Put it in order.","tiles":["It","was","hot,","so","we","swam."],"distractors":["hot"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 9, 'build_it', '{"prompt":"What does this say? Put it in order.","tiles":["It","was","hot,","so","we","swam."],"distractors":["hot"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Is the comma in the right place?","groups":["yes","no"],"items":[{"text":"The bus was late, so I walked.","group":0},{"text":"I have a cat, but I want a dog.","group":0},{"text":"Mom sang, and Dad played the piano.","group":0},{"text":"The bus was late so, I walked.","group":1},{"text":"I have a cat but, I want a dog.","group":1},{"text":"Mom sang and, Dad played the piano.","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Is the comma in the right place?","groups":["yes","no"],"items":[{"text":"The bus was late, so I walked.","group":0},{"text":"I have a cat, but I want a dog.","group":0},{"text":"Mom sang, and Dad played the piano.","group":0},{"text":"The bus was late so, I walked.","group":1},{"text":"I have a cat but, I want a dog.","group":1},{"text":"Mom sang and, Dad played the piano.","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 10, 'sort_it', '{"prompt":"Is the comma in the right place?","groups":["yes","no"],"items":[{"text":"The bus was late, so I walked.","group":0},{"text":"I have a cat, but I want a dog.","group":0},{"text":"Mom sang, and Dad played the piano.","group":0},{"text":"The bus was late so, I walked.","group":1},{"text":"I have a cat but, I want a dog.","group":1},{"text":"Mom sang and, Dad played the piano.","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"Dad made pancakes, and we ate them all.","right":true}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'compound-comma' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"Dad made pancakes, and we ate them all.","right":true}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'compound-comma', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"Dad made pancakes, and we ate them all.","right":true}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'compound-comma' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["The girl reading a book.","The girl is reading a book.","The girl are reading a book."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["The girl reading a book.","The girl is reading a book.","The girl are reading a book."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 1, 'pick_one', '{"prompt":"Which one is right?","choices":["The girl reading a book.","The girl is reading a book.","The girl are reading a book."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["Otto is drinking his juice.","Otto drinking his juice.","Otto is drink his juice."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["Otto is drinking his juice.","Otto drinking his juice.","Otto is drink his juice."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 2, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["Otto is drinking his juice.","Otto drinking his juice.","Otto is drink his juice."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["The boys is running in the park.","The boys running in the park.","The boys are running in the park."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["The boys is running in the park.","The boys running in the park.","The boys are running in the park."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 3, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["The boys is running in the park.","The boys running in the park.","The boys are running in the park."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Look! Nova","after":"in the pool.","choices":["is swimming","swimming","is swim"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Look! Nova","after":"in the pool.","choices":["is swimming","swimming","is swim"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 4, 'fill_blank', '{"before":"Look! Nova","after":"in the pool.","choices":["is swimming","swimming","is swim"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"My parents","after":"cooking dinner.","choices":["is","are","am"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"My parents","after":"cooking dinner.","choices":["is","are","am"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 5, 'fill_blank', '{"before":"My parents","after":"cooking dinner.","choices":["is","are","am"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"I am","after":"a picture.","choices":["draw","draws","drawing"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I am","after":"a picture.","choices":["draw","draws","drawing"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 6, 'fill_blank', '{"before":"I am","after":"a picture.","choices":["draw","draws","drawing"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["The","baby","sleeping","on","the","bed."],"wrongIndex":2,"fixes":["is sleeping","are sleeping","sleep"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["The","baby","sleeping","on","the","bed."],"wrongIndex":2,"fixes":["is sleeping","are sleeping","sleep"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 7, 'find_fix', '{"words":["The","baby","sleeping","on","the","bed."],"wrongIndex":2,"fixes":["is sleeping","are sleeping","sleep"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["We","are","play","tag","outside."],"wrongIndex":2,"fixes":["playing","plays","played"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["We","are","play","tag","outside."],"wrongIndex":2,"fixes":["playing","plays","played"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 8, 'find_fix', '{"words":["We","are","play","tag","outside."],"wrongIndex":2,"fixes":["playing","plays","played"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build it!","tiles":["The","dog","is","chasing","a","ball."],"distractors":["are","chase"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build it!","tiles":["The","dog","is","chasing","a","ball."],"distractors":["are","chase"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 9, 'build_it', '{"prompt":"Build it!","tiles":["The","dog","is","chasing","a","ball."],"distractors":["are","chase"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which ones are right? Sort them.","groups":["right","not right"],"items":[{"text":"She is singing.","group":0},{"text":"They are dancing.","group":0},{"text":"The dogs are barking.","group":0},{"text":"We is laughing.","group":1},{"text":"Nova running.","group":1},{"text":"I are waiting.","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which ones are right? Sort them.","groups":["right","not right"],"items":[{"text":"She is singing.","group":0},{"text":"They are dancing.","group":0},{"text":"The dogs are barking.","group":0},{"text":"We is laughing.","group":1},{"text":"Nova running.","group":1},{"text":"I are waiting.","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 10, 'sort_it', '{"prompt":"Which ones are right? Sort them.","groups":["right","not right"],"items":[{"text":"She is singing.","group":0},{"text":"They are dancing.","group":0},{"text":"The dogs are barking.","group":0},{"text":"We is laughing.","group":1},{"text":"Nova running.","group":1},{"text":"I are waiting.","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"Look! The cat is climb a tree.","right":false}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'ing' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"Look! The cat is climb a tree.","right":false}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'ing', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"Look! The cat is climb a tree.","right":false}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'ing' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["The book is in table.","The book is on the table.","The book is at table."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["The book is in table.","The book is on the table.","The book is at table."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 1, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["The book is in table.","The book is on the table.","The book is at table."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["Milo gave the note his mom.","Milo gave the note at his mom.","Milo gave the note to his mom."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["Milo gave the note his mom.","Milo gave the note at his mom.","Milo gave the note to his mom."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 2, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["Milo gave the note his mom.","Milo gave the note at his mom.","Milo gave the note to his mom."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the sentence with no mistakes.","choices":["I go to school every day.","I go at school every day.","I go in school every day."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the sentence with no mistakes.","choices":["I go to school every day.","I go at school every day.","I go in school every day."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 3, 'pick_one', '{"prompt":"Tap the sentence with no mistakes.","choices":["I go to school every day.","I go at school every day.","I go in school every day."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"The goldfish swims","after":"its bowl.","choices":["in","at","of"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The goldfish swims","after":"its bowl.","choices":["in","at","of"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 4, 'fill_blank', '{"before":"The goldfish swims","after":"its bowl.","choices":["in","at","of"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"We waited","after":"the bus stop.","choices":["in","at","to"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"We waited","after":"the bus stop.","choices":["in","at","to"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 5, 'fill_blank', '{"before":"We waited","after":"the bus stop.","choices":["in","at","to"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Finn said hello","after":"his friend.","choices":["at","in","to"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Finn said hello","after":"his friend.","choices":["at","in","to"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 6, 'fill_blank', '{"before":"Finn said hello","after":"his friend.","choices":["at","in","to"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Theo","put","his","cup","in","the","table."],"wrongIndex":4,"fixes":["on","to","of"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Theo","put","his","cup","in","the","table."],"wrongIndex":4,"fixes":["on","to","of"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 7, 'find_fix', '{"words":["Theo","put","his","cup","in","the","table."],"wrongIndex":4,"fixes":["on","to","of"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Ruby","sent","a","letter","her","grandma."],"wrongIndex":4,"fixes":["to her","at her","on her"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Ruby","sent","a","letter","her","grandma."],"wrongIndex":4,"fixes":["to her","at her","on her"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 8, 'find_fix', '{"words":["Ruby","sent","a","letter","her","grandma."],"wrongIndex":4,"fixes":["to her","at her","on her"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"What does this say? Put it in order.","tiles":["Nova","goes","to","school","by","bus."],"distractors":["at"]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"What does this say? Put it in order.","tiles":["Nova","goes","to","school","by","bus."],"distractors":["at"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 9, 'build_it', '{"prompt":"What does this say? Put it in order.","tiles":["Nova","goes","to","school","by","bus."],"distractors":["at"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which word goes with each one: on, in, or at?","groups":["on","in","at"],"items":[{"text":"Monday","group":0},{"text":"July","group":1},{"text":"7 o''clock","group":2},{"text":"my birthday","group":0},{"text":"the morning","group":1},{"text":"night","group":2}]}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which word goes with each one: on, in, or at?","groups":["on","in","at"],"items":[{"text":"Monday","group":0},{"text":"July","group":1},{"text":"7 o''clock","group":2},{"text":"my birthday","group":0},{"text":"the morning","group":1},{"text":"night","group":2}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 10, 'sort_it', '{"prompt":"Which word goes with each one: on, in, or at?","groups":["on","in","at"],"items":[{"text":"Monday","group":0},{"text":"July","group":1},{"text":"7 o''clock","group":2},{"text":"my birthday","group":0},{"text":"the morning","group":1},{"text":"night","group":2}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 10);
update wp_questions set type = 'odd_one_out', payload = '{"prompt":"Three of these are right. Which one is not?","words":["sit on the sofa","listen to Grandpa","go at the beach","swim in the lake"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 2 and skill = 'prepositions' and position = 11 and deleted_at is null and (type <> 'odd_one_out' or payload <> '{"prompt":"Three of these are right. Which one is not?","words":["sit on the sofa","listen to Grandpa","go at the beach","swim in the lake"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 2, 'prepositions', 11, 'odd_one_out', '{"prompt":"Three of these are right. Which one is not?","words":["sit on the sofa","listen to Grandpa","go at the beach","swim in the lake"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 2 and skill = 'prepositions' and position = 11);

commit;
