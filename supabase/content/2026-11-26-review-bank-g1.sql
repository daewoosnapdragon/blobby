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

-- Review bank, grade 1: questions in the app that differ from the file before this edit
select v.skill, v.pos as question_position,
       qq.payload::text as app_text, v.base::jsonb::text as file_text
from (values
  ('be'::text, 1::int, '{"prompt":"Pick the right sentence.","choices":["The boy are happy.","The boy is happy.","The boy am happy."],"answer":1}'::text),
  ('be', 2, '{"prompt":"Pick the right sentence.","choices":["Two children is at the door.","Two children am at the door.","Two children are at the door."],"answer":2}'),
  ('be', 3, '{"prompt":"Pick the right sentence.","choices":["He are my brother.","He is my brother.","He am my brother."],"answer":1}'),
  ('be', 4, '{"before":"I","after":"seven years old.","choices":["is","are","am"],"answer":2}'),
  ('be', 5, '{"before":"They","after":"in the car.","choices":["is","are","am"],"answer":1}'),
  ('be', 6, '{"before":"Mina and Leo","after":"hungry.","choices":["is","am","are"],"answer":2}'),
  ('be', 7, '{"words":["Three","dogs","is","in","the","yard."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'),
  ('be', 8, '{"words":["Ben","are","in","my","class."],"wrongIndex":1,"fixes":["is","am","be"],"answer":0}'),
  ('be', 9, '{"prompt":"Build the sentence.","tiles":["It","is","a","big","box."],"distractors":["are","am"]}'),
  ('be', 10, '{"prompt":"Sort the words.","groups":["am","is","are"],"items":[{"text":"I","group":0},{"text":"he","group":1},{"text":"the bird","group":1},{"text":"you","group":2},{"text":"three boys","group":2},{"text":"we","group":2}]}'),
  ('be', 11, null),
  ('ing', 1, '{"prompt":"Pick the right sentence.","choices":["Two girls jumping.","Two girls is jumping.","Two girls are jumping."],"answer":2}'),
  ('ing', 2, '{"prompt":"Pick the right sentence.","choices":["She is watch TV.","She is watching TV.","She watching TV."],"answer":1}'),
  ('ing', 3, '{"prompt":"Pick the right sentence.","choices":["Three kids are siting on the rug.","Three kids are sitting on the rug.","Three kids is sitting on the rug."],"answer":1}'),
  ('ing', 4, '{"before":"Mina is","after":"a picture.","choices":["draw","drawing","draws"],"answer":1}'),
  ('ing', 5, '{"before":"The birds","after":"singing.","choices":["is","are","am"],"answer":1}'),
  ('ing', 6, '{"before":"I","after":"eating an apple.","choices":["am","is","are"],"answer":0}'),
  ('ing', 7, '{"words":["Mom","is","cook","dinner."],"wrongIndex":2,"fixes":["cooking","cooks","cooked"],"answer":0}'),
  ('ing', 8, '{"words":["Sam","and","Ben","is","playing","tag."],"wrongIndex":3,"fixes":["are","am","be"],"answer":0}'),
  ('ing', 9, '{"prompt":"Build the sentence.","tiles":["The","boys","are","playing","soccer."],"distractors":["is"]}'),
  ('ing', 10, '{"prompt":"Is the sentence right or wrong?","groups":["Right","Wrong"],"items":[{"text":"She is singing.","group":0},{"text":"They are clapping.","group":0},{"text":"The dog is barking.","group":0},{"text":"He is swim.","group":1},{"text":"We sleeping.","group":1},{"text":"Two boys is running.","group":1}]}'),
  ('ing', 11, null),
  ('sentence-ends', 1, '{"prompt":"Pick the right sentences.","choices":["I have a ball. It is red.","I have a ball. it is red.","I have a ball it is red."],"answer":0}'),
  ('sentence-ends', 2, '{"prompt":"Pick the right sentences.","choices":["Sam has a cat the cat is gray.","Sam has a cat. the cat is gray.","Sam has a cat. The cat is gray."],"answer":2}'),
  ('sentence-ends', 3, '{"prompt":"Pick the right sentence.","choices":["the bus is yellow.","The bus is yellow.","The bus is yellow"],"answer":1}'),
  ('sentence-ends', 4, '{"before":"","after":"frog can jump.","choices":["the","The"],"answer":1}'),
  ('sentence-ends', 5, '{"before":"I like to swim.","after":"is fun.","choices":["it","It","it."],"answer":1}'),
  ('sentence-ends', 6, '{"before":"Leo is my","after":"","choices":["friend","friend.","Friend."],"answer":1}'),
  ('sentence-ends', 7, '{"words":["The","cake","is","sweet"],"wrongIndex":3,"fixes":["sweet.","Sweet.","sweet,"],"answer":0}'),
  ('sentence-ends', 8, '{"words":["Tom","has","a","hat.","his","hat","is","blue."],"wrongIndex":4,"fixes":["His","His.","his,"],"answer":0}'),
  ('sentence-ends', 9, '{"prompt":"Build the sentence.","tiles":["The","little","fish","can","swim."],"distractors":["the","swim"]}'),
  ('sentence-ends', 10, '{"prompt":"Is the sentence right or wrong?","groups":["Right","Wrong"],"items":[{"text":"We like pizza.","group":0},{"text":"I can run.","group":0},{"text":"The bus is big.","group":0},{"text":"we like cake.","group":1},{"text":"My hat is red","group":1},{"text":"it is cold.","group":1}]}'),
  ('sentence-ends', 11, null),
  ('articles', 1, '{"prompt":"Pick the right sentence.","choices":["I see teacher.","I see a teacher.","I see an teacher."],"answer":1}'),
  ('articles', 2, '{"prompt":"Pick the right sentence.","choices":["Mia has an egg.","Mia has a egg.","Mia has egg."],"answer":0}'),
  ('articles', 3, '{"prompt":"Pick the right sentence.","choices":["Ben is eating a apple.","Ben is eating apple.","Ben is eating an apple."],"answer":2}'),
  ('articles', 4, '{"before":"I have","after":"pencil.","choices":["a","an","two"],"answer":0}'),
  ('articles', 5, '{"before":"There is","after":"ant on my leg.","choices":["a","an","two"],"answer":1}'),
  ('articles', 6, '{"before":"My mom is","after":"doctor.","choices":["a","an","two"],"answer":0}'),
  ('articles', 7, '{"words":["I","see","a","elephant."],"wrongIndex":2,"fixes":["an","two","many"],"answer":0}'),
  ('articles', 8, '{"words":["Leo","has","dog."],"wrongIndex":2,"fixes":["a dog.","an dog.","two dog."],"answer":0}'),
  ('articles', 9, '{"prompt":"Build the sentence.","tiles":["I","see","an","owl","in","the","tree."],"distractors":["a"]}'),
  ('articles', 10, '{"prompt":"Sort the words: a or an?","groups":["a","an"],"items":[{"text":"ball","group":0},{"text":"ant","group":1},{"text":"hat","group":0},{"text":"owl","group":1},{"text":"cup","group":0},{"text":"egg","group":1}]}'),
  ('articles', 11, null),
  ('plurals', 1, '{"prompt":"Pick the right sentence.","choices":["I have a ten chairs.","I have ten chairs.","I have ten chair."],"answer":1}'),
  ('plurals', 2, '{"prompt":"Pick the right sentence.","choices":["I see one children.","I see one child.","I see one childs."],"answer":1}'),
  ('plurals', 3, '{"prompt":"Pick the right sentence.","choices":["Tom has 4 pencil.","Tom has 4 pencils.","Tom has a 4 pencils."],"answer":1}'),
  ('plurals', 4, '{"before":"Mia has three","after":"at home.","choices":["dog","dogs","a dog"],"answer":1}'),
  ('plurals', 5, '{"before":"There is one","after":"in the box.","choices":["toy","toys"],"answer":0}'),
  ('plurals', 6, '{"before":"Many","after":"are at the park.","choices":["people","peoples","person"],"answer":0}'),
  ('plurals', 7, '{"words":["Three","bird","are","in","the","tree."],"wrongIndex":1,"fixes":["birds","birdes","a bird"],"answer":0}'),
  ('plurals', 8, '{"words":["Two","child","are","in","the","pool."],"wrongIndex":1,"fixes":["children","childs","childrens"],"answer":0}'),
  ('plurals', 9, '{"prompt":"Build the sentence.","tiles":["I","have","two","red","balls."],"distractors":["ball.","a"]}'),
  ('plurals', 10, '{"prompt":"Sort the words.","groups":["one","more than one"],"items":[{"text":"dog","group":0},{"text":"dogs","group":1},{"text":"child","group":0},{"text":"children","group":1},{"text":"box","group":0},{"text":"boxes","group":1}]}'),
  ('plurals', 11, null),
  ('third-person-s', 1, '{"prompt":"Pick the right sentence.","choices":["She like cats.","She likes cats.","She liking cats."],"answer":1}'),
  ('third-person-s', 2, '{"prompt":"Pick the right sentence.","choices":["The dog run fast.","The dog runs fast.","The dog running fast."],"answer":1}'),
  ('third-person-s', 3, '{"prompt":"Pick the right sentence.","choices":["Leo plays with his toys.","Leo play with his toys.","Leo playing with his toys."],"answer":0}'),
  ('third-person-s', 4, '{"before":"He","after":"milk.","choices":["drink","drinks","drinking"],"answer":1}'),
  ('third-person-s', 5, '{"before":"Mina","after":"to school.","choices":["walk","walks","walking"],"answer":1}'),
  ('third-person-s', 6, '{"before":"I","after":"my dog.","choices":["love","loves","loving"],"answer":0}'),
  ('third-person-s', 7, '{"words":["Sam","eat","rice","every","day."],"wrongIndex":1,"fixes":["eats","eating","to eat"],"answer":0}'),
  ('third-person-s', 8, '{"words":["Mia","sing","every","morning."],"wrongIndex":1,"fixes":["sings","singing","to sing"],"answer":0}'),
  ('third-person-s', 9, '{"prompt":"Build the sentence.","tiles":["My","dad","drives","a","car."],"distractors":["drive"]}'),
  ('third-person-s', 10, '{"prompt":"Sort the words: she or they?","groups":["she","they"],"items":[{"text":"runs","group":0},{"text":"run","group":1},{"text":"plays","group":0},{"text":"play","group":1},{"text":"eats","group":0},{"text":"eat","group":1}]}'),
  ('third-person-s', 11, null),
  ('prepositions', 1, '{"prompt":"Pick the right sentence.","choices":["Mina is looking a book.","Mina is looking at a book.","Mina is looking to a book."],"answer":1}'),
  ('prepositions', 2, '{"prompt":"Pick the right sentence.","choices":["Leo is in front of the door.","Leo is front of the door.","Leo is in front the door."],"answer":0}'),
  ('prepositions', 3, '{"prompt":"Pick the right sentence.","choices":["We go to school.","We go at school.","We go school."],"answer":0}'),
  ('prepositions', 4, '{"before":"Sam is listening","after":"music.","choices":["to","at","on"],"answer":0}'),
  ('prepositions', 5, '{"before":"Look","after":"the bird!","choices":["at","on","of"],"answer":0}'),
  ('prepositions', 6, '{"before":"Tom sits next","after":"Mia.","choices":["to","at","of"],"answer":0}'),
  ('prepositions', 7, '{"words":["The","ball","is","front","of","the","box."],"wrongIndex":3,"fixes":["in front","on front","at front"],"answer":0}'),
  ('prepositions', 8, '{"words":["We","are","going","the","park."],"wrongIndex":2,"fixes":["going to","going at","going on"],"answer":0}'),
  ('prepositions', 9, '{"prompt":"Build the sentence.","tiles":["Mina","is","looking","at","the","moon."],"distractors":["to"]}'),
  ('prepositions', 10, '{"prompt":"Right or wrong?","groups":["Right","Wrong"],"items":[{"text":"look at the cat","group":0},{"text":"go to bed","group":0},{"text":"in front of me","group":0},{"text":"look the cat","group":1},{"text":"go at bed","group":1},{"text":"front of me","group":1}]}'),
  ('prepositions', 11, null),
  ('past-tense', 1, '{"prompt":"Pick the right sentence.","choices":["Yesterday, I go to the zoo.","Yesterday, I went to the zoo.","Yesterday, I goed to the zoo."],"answer":1}'),
  ('past-tense', 2, '{"prompt":"Pick the right sentence.","choices":["Yesterday, Leo play soccer.","Yesterday, Leo played soccer.","Yesterday, Leo playing soccer."],"answer":1}'),
  ('past-tense', 3, '{"prompt":"Pick the right sentence.","choices":["Yesterday, I see a big dog.","Yesterday, I saw a big dog.","Yesterday, I seed a big dog."],"answer":1}'),
  ('past-tense', 4, '{"before":"Yesterday, we","after":"in the park.","choices":["play","played","playing"],"answer":1}'),
  ('past-tense', 5, '{"before":"Yesterday, Sam","after":"to the store.","choices":["went","goes","go"],"answer":0}'),
  ('past-tense', 6, '{"before":"Yesterday, Ben","after":"yes.","choices":["said","says","say"],"answer":0}'),
  ('past-tense', 7, '{"words":["Yesterday,","I","walk","to","school."],"wrongIndex":2,"fixes":["walked","walking","walks"],"answer":0}'),
  ('past-tense', 8, '{"words":["Yesterday,","Tom","see","a","rainbow."],"wrongIndex":2,"fixes":["saw","seed","sees"],"answer":0}'),
  ('past-tense', 9, '{"prompt":"Build the sentence.","tiles":["Yesterday,","we","played","in","the","snow."],"distractors":["play"]}'),
  ('past-tense', 10, '{"prompt":"Sort the words.","groups":["now","in the past"],"items":[{"text":"play","group":0},{"text":"played","group":1},{"text":"go","group":0},{"text":"went","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'),
  ('past-tense', 11, null),
  ('capitals-names', 1, '{"prompt":"Pick the right sentence.","choices":["I like leo.","i like Leo.","I like Leo."],"answer":2}'),
  ('capitals-names', 2, '{"prompt":"Pick the right sentence.","choices":["ben and i are friends.","Ben and I are friends.","Ben and i are friends."],"answer":1}'),
  ('capitals-names', 3, '{"prompt":"Pick the right sentence.","choices":["My name is Tom.","My name is tom.","my name is Tom."],"answer":0}'),
  ('capitals-names', 4, '{"before":"I play with","after":"every day.","choices":["mina","Mina"],"answer":1}'),
  ('capitals-names', 5, '{"before":"Sam and","after":"like to draw.","choices":["i","I"],"answer":1}'),
  ('capitals-names', 6, '{"before":"","after":"has a green hat.","choices":["tom","Tom"],"answer":1}'),
  ('capitals-names', 7, '{"words":["Mina","and","i","are","seven."],"wrongIndex":2,"fixes":["I","I.","i,"],"answer":0}'),
  ('capitals-names', 8, '{"words":["I","sit","next","to","sam."],"wrongIndex":4,"fixes":["Sam.","Sam","sam,"],"answer":0}'),
  ('capitals-names', 9, '{"prompt":"Build the sentence.","tiles":["I","see","Ben","at","school."],"distractors":["ben","i"]}'),
  ('capitals-names', 10, '{"prompt":"Is it written the right way?","groups":["Right","Wrong"],"items":[{"text":"Ben","group":0},{"text":"Mia","group":0},{"text":"I can","group":0},{"text":"mina","group":1},{"text":"sam","group":1},{"text":"i see","group":1}]}'),
  ('capitals-names', 11, null),
  ('place-words', 1, '{"prompt":"Pick the right sentence.","choices":["The cat is under of the table.","The cat is under the table.","The cat is under table."],"answer":1}'),
  ('place-words', 2, '{"prompt":"Pick the right sentence.","choices":["The ball is next the bed.","The ball is next to the bed.","The ball is next of the bed."],"answer":1}'),
  ('place-words', 3, '{"prompt":"Pick the right sentence.","choices":["My pencil is in the box.","My pencil is in of the box.","My pencil is of the box."],"answer":0}'),
  ('place-words', 4, '{"before":"I wear a hat","after":"my head.","choices":["on","in","under"],"answer":0}'),
  ('place-words', 5, '{"before":"The floor is","after":"my feet.","choices":["on","in","under"],"answer":2}'),
  ('place-words', 6, '{"before":"The milk is","after":"the cup.","choices":["on","in","under"],"answer":1}'),
  ('place-words', 7, '{"words":["The","dog","is","next","the","door."],"wrongIndex":3,"fixes":["next to","next of","next at"],"answer":0}'),
  ('place-words', 8, '{"words":["The","plane","is","on","the","sky."],"wrongIndex":3,"fixes":["in","at","of"],"answer":0}'),
  ('place-words', 9, '{"prompt":"Build the sentence.","tiles":["The","shoes","are","under","the","bed."],"distractors":["of"]}'),
  ('place-words', 10, '{"prompt":"Right or wrong?","groups":["Right","Wrong"],"items":[{"text":"in the box","group":0},{"text":"on the desk","group":0},{"text":"next to the bed","group":0},{"text":"next the bed","group":1},{"text":"under of the chair","group":1},{"text":"in front the door","group":1}]}'),
  ('place-words', 11, null)
) as v(skill, pos, base)
join wp_questions qq on qq.bank_grade = 1 and qq.skill = v.skill and qq.position = v.pos and qq.deleted_at is null
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

-- Review bank, grade 1: 110 questions
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["The boy are happy.","The boy is happy.","The boy am happy."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["The boy are happy.","The boy is happy.","The boy am happy."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 1, 'pick_one', '{"prompt":"Which one is right?","choices":["The boy are happy.","The boy is happy.","The boy am happy."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["Two children is at the door.","Two children am at the door.","Two children are at the door."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["Two children is at the door.","Two children am at the door.","Two children are at the door."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 2, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["Two children is at the door.","Two children am at the door.","Two children are at the door."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["He are my brother.","He is my brother.","He am my brother."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["He are my brother.","He is my brother.","He am my brother."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 3, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["He are my brother.","He is my brother.","He am my brother."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"I","after":"seven years old.","choices":["is","are","am"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I","after":"seven years old.","choices":["is","are","am"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 4, 'fill_blank', '{"before":"I","after":"seven years old.","choices":["is","are","am"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"They","after":"in the car.","choices":["is","are","am"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"They","after":"in the car.","choices":["is","are","am"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 5, 'fill_blank', '{"before":"They","after":"in the car.","choices":["is","are","am"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Ruby and Milo","after":"hungry.","choices":["is","am","are"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Ruby and Milo","after":"hungry.","choices":["is","am","are"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 6, 'fill_blank', '{"before":"Ruby and Milo","after":"hungry.","choices":["is","am","are"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Three","bears","is","in","the","bath."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Three","bears","is","in","the","bath."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 7, 'find_fix', '{"words":["Three","bears","is","in","the","bath."],"wrongIndex":2,"fixes":["are","am","be"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Otto","are","in","my","class."],"wrongIndex":1,"fixes":["is","am","be"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Otto","are","in","my","class."],"wrongIndex":1,"fixes":["is","am","be"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 8, 'find_fix', '{"words":["Otto","are","in","my","class."],"wrongIndex":1,"fixes":["is","am","be"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["It","is","a","big","box."],"distractors":["are","am"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["It","is","a","big","box."],"distractors":["are","am"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["It","is","a","big","box."],"distractors":["are","am"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Sort the words.","groups":["am","is","are"],"items":[{"text":"I","group":0},{"text":"he","group":1},{"text":"the bird","group":1},{"text":"you","group":2},{"text":"three boys","group":2},{"text":"we","group":2}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Sort the words.","groups":["am","is","are"],"items":[{"text":"I","group":0},{"text":"he","group":1},{"text":"the bird","group":1},{"text":"you","group":2},{"text":"three boys","group":2},{"text":"we","group":2}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 10, 'sort_it', '{"prompt":"Sort the words.","groups":["am","is","are"],"items":[{"text":"I","group":0},{"text":"he","group":1},{"text":"the bird","group":1},{"text":"you","group":2},{"text":"three boys","group":2},{"text":"we","group":2}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 10);
update wp_questions set type = 'match_pairs', payload = '{"prompt":"Match each one to am, is or are.","pairs":[{"left":"I","right":"am"},{"left":"Blobby","right":"is"},{"left":"the cats","right":"are"}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'be' and position = 11 and deleted_at is null and (type <> 'match_pairs' or payload <> '{"prompt":"Match each one to am, is or are.","pairs":[{"left":"I","right":"am"},{"left":"Blobby","right":"is"},{"left":"the cats","right":"are"}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'be', 11, 'match_pairs', '{"prompt":"Match each one to am, is or are.","pairs":[{"left":"I","right":"am"},{"left":"Blobby","right":"is"},{"left":"the cats","right":"are"}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'be' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["Two girls jumping.","Two girls is jumping.","Two girls are jumping."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["Two girls jumping.","Two girls is jumping.","Two girls are jumping."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 1, 'pick_one', '{"prompt":"Which one is right?","choices":["Two girls jumping.","Two girls is jumping.","Two girls are jumping."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["She is watch TV.","She is watching TV.","She watching TV."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["She is watch TV.","She is watching TV.","She watching TV."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 2, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["She is watch TV.","She is watching TV.","She watching TV."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["Three kids are siting on the rug.","Three kids are sitting on the rug.","Three kids is sitting on the rug."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["Three kids are siting on the rug.","Three kids are sitting on the rug.","Three kids is sitting on the rug."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 3, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["Three kids are siting on the rug.","Three kids are sitting on the rug.","Three kids is sitting on the rug."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"The cat is","after":"a picture.","choices":["draw","drawing","draws"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The cat is","after":"a picture.","choices":["draw","drawing","draws"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 4, 'fill_blank', '{"before":"The cat is","after":"a picture.","choices":["draw","drawing","draws"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"The birds","after":"singing.","choices":["is","are","am"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The birds","after":"singing.","choices":["is","are","am"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 5, 'fill_blank', '{"before":"The birds","after":"singing.","choices":["is","are","am"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"I","after":"eating an apple.","choices":["am","is","are"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I","after":"eating an apple.","choices":["am","is","are"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 6, 'fill_blank', '{"before":"I","after":"eating an apple.","choices":["am","is","are"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Mom","is","cook","dinner."],"wrongIndex":2,"fixes":["cooking","cooks","cooked"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Mom","is","cook","dinner."],"wrongIndex":2,"fixes":["cooking","cooks","cooked"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 7, 'find_fix', '{"words":["Mom","is","cook","dinner."],"wrongIndex":2,"fixes":["cooking","cooks","cooked"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Finn","and","Otto","is","playing","tag."],"wrongIndex":3,"fixes":["are","am","be"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Finn","and","Otto","is","playing","tag."],"wrongIndex":3,"fixes":["are","am","be"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 8, 'find_fix', '{"words":["Finn","and","Otto","is","playing","tag."],"wrongIndex":3,"fixes":["are","am","be"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build it!","tiles":["The","boys","are","playing","soccer."],"distractors":["is"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build it!","tiles":["The","boys","are","playing","soccer."],"distractors":["is"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 9, 'build_it', '{"prompt":"Build it!","tiles":["The","boys","are","playing","soccer."],"distractors":["is"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"She is singing.","group":0},{"text":"They are clapping.","group":0},{"text":"The dog is barking.","group":0},{"text":"He is swim.","group":1},{"text":"We sleeping.","group":1},{"text":"Two boys is running.","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"She is singing.","group":0},{"text":"They are clapping.","group":0},{"text":"The dog is barking.","group":0},{"text":"He is swim.","group":1},{"text":"We sleeping.","group":1},{"text":"Two boys is running.","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 10, 'sort_it', '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"She is singing.","group":0},{"text":"They are clapping.","group":0},{"text":"The dog is barking.","group":0},{"text":"He is swim.","group":1},{"text":"We sleeping.","group":1},{"text":"Two boys is running.","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"The pig is ride a bike.","right":false}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'ing' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"The pig is ride a bike.","right":false}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'ing', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"The pig is ride a bike.","right":false}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'ing' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one has the capital letters and periods right?","choices":["I have a ball. It is red.","I have a ball. it is red.","I have a ball it is red."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one has the capital letters and periods right?","choices":["I have a ball. It is red.","I have a ball. it is red.","I have a ball it is red."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 1, 'pick_one', '{"prompt":"Which one has the capital letters and periods right?","choices":["I have a ball. It is red.","I have a ball. it is red.","I have a ball it is red."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["Finn has a cat the cat is gray.","Finn has a cat. the cat is gray.","Finn has a cat. The cat is gray."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["Finn has a cat the cat is gray.","Finn has a cat. the cat is gray.","Finn has a cat. The cat is gray."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 2, 'pick_one', '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["Finn has a cat the cat is gray.","Finn has a cat. the cat is gray.","Finn has a cat. The cat is gray."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which sentence starts and ends the right way?","choices":["the bus is yellow.","The bus is yellow.","The bus is yellow"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which sentence starts and ends the right way?","choices":["the bus is yellow.","The bus is yellow.","The bus is yellow"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 3, 'pick_one', '{"prompt":"Which sentence starts and ends the right way?","choices":["the bus is yellow.","The bus is yellow.","The bus is yellow"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"","after":"frog can jump.","choices":["the","The"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"","after":"frog can jump.","choices":["the","The"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 4, 'fill_blank', '{"before":"","after":"frog can jump.","choices":["the","The"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"I like to swim.","after":"is fun.","choices":["it","It","it."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I like to swim.","after":"is fun.","choices":["it","It","it."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 5, 'fill_blank', '{"before":"I like to swim.","after":"is fun.","choices":["it","It","it."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Milo is my","after":"","choices":["friend","friend.","Friend."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Milo is my","after":"","choices":["friend","friend.","Friend."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 6, 'fill_blank', '{"before":"Milo is my","after":"","choices":["friend","friend.","Friend."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["The","cake","is","sweet"],"wrongIndex":3,"fixes":["sweet.","Sweet.","sweet,"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["The","cake","is","sweet"],"wrongIndex":3,"fixes":["sweet.","Sweet.","sweet,"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 7, 'find_fix', '{"words":["The","cake","is","sweet"],"wrongIndex":3,"fixes":["sweet.","Sweet.","sweet,"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Theo","has","a","hat.","his","hat","is","blue."],"wrongIndex":4,"fixes":["His","His.","his,"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Theo","has","a","hat.","his","hat","is","blue."],"wrongIndex":4,"fixes":["His","His.","his,"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 8, 'find_fix', '{"words":["Theo","has","a","hat.","his","hat","is","blue."],"wrongIndex":4,"fixes":["His","His.","his,"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Tap the tiles in order.","tiles":["The","little","fish","can","swim."],"distractors":["the","swim"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Tap the tiles in order.","tiles":["The","little","fish","can","swim."],"distractors":["the","swim"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 9, 'build_it', '{"prompt":"Tap the tiles in order.","tiles":["The","little","fish","can","swim."],"distractors":["the","swim"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"We like pizza.","group":0},{"text":"I can run.","group":0},{"text":"The bus is big.","group":0},{"text":"we like cake.","group":1},{"text":"My hat is red","group":1},{"text":"it is cold.","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"We like pizza.","group":0},{"text":"I can run.","group":0},{"text":"The bus is big.","group":0},{"text":"we like cake.","group":1},{"text":"My hat is red","group":1},{"text":"it is cold.","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 10, 'sort_it', '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"We like pizza.","group":0},{"text":"I can run.","group":0},{"text":"The bus is big.","group":0},{"text":"we like cake.","group":1},{"text":"My hat is red","group":1},{"text":"it is cold.","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 10);
update wp_questions set type = 'tap_all', payload = '{"prompt":"Tap every word that needs a capital letter.","words":["we","see","the","moon.","it","is","so","big."],"answers":[0,4]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'sentence-ends' and position = 11 and deleted_at is null and (type <> 'tap_all' or payload <> '{"prompt":"Tap every word that needs a capital letter.","words":["we","see","the","moon.","it","is","so","big."],"answers":[0,4]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'sentence-ends', 11, 'tap_all', '{"prompt":"Tap every word that needs a capital letter.","words":["we","see","the","moon.","it","is","so","big."],"answers":[0,4]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'sentence-ends' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["I see teacher.","I see a teacher.","I see an teacher."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["I see teacher.","I see a teacher.","I see an teacher."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 1, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["I see teacher.","I see a teacher.","I see an teacher."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["Nova has an egg.","Nova has a egg.","Nova has egg."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["Nova has an egg.","Nova has a egg.","Nova has egg."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 2, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["Nova has an egg.","Nova has a egg.","Nova has egg."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["Otto is eating a apple.","Otto is eating apple.","Otto is eating an apple."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["Otto is eating a apple.","Otto is eating apple.","Otto is eating an apple."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 3, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["Otto is eating a apple.","Otto is eating apple.","Otto is eating an apple."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"I have","after":"pencil.","choices":["a","an","two"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I have","after":"pencil.","choices":["a","an","two"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 4, 'fill_blank', '{"before":"I have","after":"pencil.","choices":["a","an","two"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"There is","after":"ant on my leg.","choices":["a","an","two"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"There is","after":"ant on my leg.","choices":["a","an","two"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 5, 'fill_blank', '{"before":"There is","after":"ant on my leg.","choices":["a","an","two"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"My dog is","after":"doctor.","choices":["a","an","two"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"My dog is","after":"doctor.","choices":["a","an","two"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 6, 'fill_blank', '{"before":"My dog is","after":"doctor.","choices":["a","an","two"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["I","see","a","elephant."],"wrongIndex":2,"fixes":["an","two","many"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["I","see","a","elephant."],"wrongIndex":2,"fixes":["an","two","many"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 7, 'find_fix', '{"words":["I","see","a","elephant."],"wrongIndex":2,"fixes":["an","two","many"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Milo","has","dog."],"wrongIndex":2,"fixes":["a dog.","an dog.","two dog."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Milo","has","dog."],"wrongIndex":2,"fixes":["a dog.","an dog.","two dog."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 8, 'find_fix', '{"words":["Milo","has","dog."],"wrongIndex":2,"fixes":["a dog.","an dog.","two dog."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["I","see","an","owl","in","the","tree."],"distractors":["a"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["I","see","an","owl","in","the","tree."],"distractors":["a"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["I","see","an","owl","in","the","tree."],"distractors":["a"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Sort the words: a or an?","groups":["a","an"],"items":[{"text":"ball","group":0},{"text":"ant","group":1},{"text":"hat","group":0},{"text":"owl","group":1},{"text":"cup","group":0},{"text":"egg","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Sort the words: a or an?","groups":["a","an"],"items":[{"text":"ball","group":0},{"text":"ant","group":1},{"text":"hat","group":0},{"text":"owl","group":1},{"text":"cup","group":0},{"text":"egg","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 10, 'sort_it', '{"prompt":"Sort the words: a or an?","groups":["a","an"],"items":[{"text":"ball","group":0},{"text":"ant","group":1},{"text":"hat","group":0},{"text":"owl","group":1},{"text":"cup","group":0},{"text":"egg","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 10);
update wp_questions set type = 'odd_one_out', payload = '{"prompt":"Three of these go with \"an\". Which one does not?","words":["arm","ear","toe","eye"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'articles' and position = 11 and deleted_at is null and (type <> 'odd_one_out' or payload <> '{"prompt":"Three of these go with \"an\". Which one does not?","words":["arm","ear","toe","eye"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'articles', 11, 'odd_one_out', '{"prompt":"Three of these go with \"an\". Which one does not?","words":["arm","ear","toe","eye"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'articles' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["I have a ten chairs.","I have ten chairs.","I have ten chair."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["I have a ten chairs.","I have ten chairs.","I have ten chair."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 1, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["I have a ten chairs.","I have ten chairs.","I have ten chair."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["I see one children.","I see one child.","I see one childs."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["I see one children.","I see one child.","I see one childs."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 2, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["I see one children.","I see one child.","I see one childs."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["Theo has 4 pencil.","Theo has 4 pencils.","Theo has a 4 pencils."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["Theo has 4 pencil.","Theo has 4 pencils.","Theo has a 4 pencils."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 3, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["Theo has 4 pencil.","Theo has 4 pencils.","Theo has a 4 pencils."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Nova has three","after":"at home.","choices":["dog","dogs","a dog"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Nova has three","after":"at home.","choices":["dog","dogs","a dog"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 4, 'fill_blank', '{"before":"Nova has three","after":"at home.","choices":["dog","dogs","a dog"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"There is one","after":"in the box.","choices":["toy","toys"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"There is one","after":"in the box.","choices":["toy","toys"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 5, 'fill_blank', '{"before":"There is one","after":"in the box.","choices":["toy","toys"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Many","after":"are at the park.","choices":["people","peoples","person"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Many","after":"are at the park.","choices":["people","peoples","person"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 6, 'fill_blank', '{"before":"Many","after":"are at the park.","choices":["people","peoples","person"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Three","bird","are","in","the","tree."],"wrongIndex":1,"fixes":["birds","birdes","a bird"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Three","bird","are","in","the","tree."],"wrongIndex":1,"fixes":["birds","birdes","a bird"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 7, 'find_fix', '{"words":["Three","bird","are","in","the","tree."],"wrongIndex":1,"fixes":["birds","birdes","a bird"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Two","child","are","in","the","pool."],"wrongIndex":1,"fixes":["children","childs","childrens"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Two","child","are","in","the","pool."],"wrongIndex":1,"fixes":["children","childs","childrens"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 8, 'find_fix', '{"words":["Two","child","are","in","the","pool."],"wrongIndex":1,"fixes":["children","childs","childrens"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Make a sentence from the tiles.","tiles":["I","have","two","red","balls."],"distractors":["ball.","a"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Make a sentence from the tiles.","tiles":["I","have","two","red","balls."],"distractors":["ball.","a"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 9, 'build_it', '{"prompt":"Make a sentence from the tiles.","tiles":["I","have","two","red","balls."],"distractors":["ball.","a"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Sort the words.","groups":["one","more than one"],"items":[{"text":"dog","group":0},{"text":"dogs","group":1},{"text":"child","group":0},{"text":"children","group":1},{"text":"box","group":0},{"text":"boxes","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Sort the words.","groups":["one","more than one"],"items":[{"text":"dog","group":0},{"text":"dogs","group":1},{"text":"child","group":0},{"text":"children","group":1},{"text":"box","group":0},{"text":"boxes","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 10, 'sort_it', '{"prompt":"Sort the words.","groups":["one","more than one"],"items":[{"text":"dog","group":0},{"text":"dogs","group":1},{"text":"child","group":0},{"text":"children","group":1},{"text":"box","group":0},{"text":"boxes","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 10);
update wp_questions set type = 'tap_all', payload = '{"prompt":"Tap every word that means more than one.","words":["cat","ducks","bus","feet","cup","socks"],"answers":[1,3,5]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'plurals' and position = 11 and deleted_at is null and (type <> 'tap_all' or payload <> '{"prompt":"Tap every word that means more than one.","words":["cat","ducks","bus","feet","cup","socks"],"answers":[1,3,5]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'plurals', 11, 'tap_all', '{"prompt":"Tap every word that means more than one.","words":["cat","ducks","bus","feet","cup","socks"],"answers":[1,3,5]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'plurals' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["She like cats.","She likes cats.","She liking cats."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["She like cats.","She likes cats.","She liking cats."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 1, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["She like cats.","She likes cats.","She liking cats."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["The dog run fast.","The dog runs fast.","The dog running fast."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["The dog run fast.","The dog runs fast.","The dog running fast."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 2, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["The dog run fast.","The dog runs fast.","The dog running fast."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the sentence with no mistakes.","choices":["Milo plays with his toys.","Milo play with his toys.","Milo playing with his toys."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the sentence with no mistakes.","choices":["Milo plays with his toys.","Milo play with his toys.","Milo playing with his toys."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 3, 'pick_one', '{"prompt":"Tap the sentence with no mistakes.","choices":["Milo plays with his toys.","Milo play with his toys.","Milo playing with his toys."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"He","after":"milk.","choices":["drink","drinks","drinking"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"He","after":"milk.","choices":["drink","drinks","drinking"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 4, 'fill_blank', '{"before":"He","after":"milk.","choices":["drink","drinks","drinking"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"The cow","after":"to school.","choices":["walk","walks","walking"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The cow","after":"to school.","choices":["walk","walks","walking"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 5, 'fill_blank', '{"before":"The cow","after":"to school.","choices":["walk","walks","walking"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"I","after":"my dog.","choices":["love","loves","loving"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I","after":"my dog.","choices":["love","loves","loving"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 6, 'fill_blank', '{"before":"I","after":"my dog.","choices":["love","loves","loving"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Finn","eat","rice","every","day."],"wrongIndex":1,"fixes":["eats","eating","to eat"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Finn","eat","rice","every","day."],"wrongIndex":1,"fixes":["eats","eating","to eat"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 7, 'find_fix', '{"words":["Finn","eat","rice","every","day."],"wrongIndex":1,"fixes":["eats","eating","to eat"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Nova","sing","every","morning."],"wrongIndex":1,"fixes":["sings","singing","to sing"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Nova","sing","every","morning."],"wrongIndex":1,"fixes":["sings","singing","to sing"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 8, 'find_fix', '{"words":["Nova","sing","every","morning."],"wrongIndex":1,"fixes":["sings","singing","to sing"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["My","dad","drives","a","car."],"distractors":["drive"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["My","dad","drives","a","car."],"distractors":["drive"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["My","dad","drives","a","car."],"distractors":["drive"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Sort the words: she or they?","groups":["she","they"],"items":[{"text":"runs","group":0},{"text":"run","group":1},{"text":"plays","group":0},{"text":"play","group":1},{"text":"eats","group":0},{"text":"eat","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Sort the words: she or they?","groups":["she","they"],"items":[{"text":"runs","group":0},{"text":"run","group":1},{"text":"plays","group":0},{"text":"play","group":1},{"text":"eats","group":0},{"text":"eat","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 10, 'sort_it', '{"prompt":"Sort the words: she or they?","groups":["she","they"],"items":[{"text":"runs","group":0},{"text":"run","group":1},{"text":"plays","group":0},{"text":"play","group":1},{"text":"eats","group":0},{"text":"eat","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"Pip sleeps on my bed.","right":true}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'third-person-s' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"Pip sleeps on my bed.","right":true}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'third-person-s', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"Pip sleeps on my bed.","right":true}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'third-person-s' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["Ruby is looking a book.","Ruby is looking at a book.","Ruby is looking to a book."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["Ruby is looking a book.","Ruby is looking at a book.","Ruby is looking to a book."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 1, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["Ruby is looking a book.","Ruby is looking at a book.","Ruby is looking to a book."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["Milo is in front of the door.","Milo is front of the door.","Milo is in front the door."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["Milo is in front of the door.","Milo is front of the door.","Milo is in front the door."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 2, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["Milo is in front of the door.","Milo is front of the door.","Milo is in front the door."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the sentence with no mistakes.","choices":["We go to school.","We go at school.","We go school."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the sentence with no mistakes.","choices":["We go to school.","We go at school.","We go school."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 3, 'pick_one', '{"prompt":"Tap the sentence with no mistakes.","choices":["We go to school.","We go at school.","We go school."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Finn is listening","after":"music.","choices":["to","at","on"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Finn is listening","after":"music.","choices":["to","at","on"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 4, 'fill_blank', '{"before":"Finn is listening","after":"music.","choices":["to","at","on"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Look","after":"the bird!","choices":["at","on","of"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Look","after":"the bird!","choices":["at","on","of"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 5, 'fill_blank', '{"before":"Look","after":"the bird!","choices":["at","on","of"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Theo sits next","after":"Nova.","choices":["to","at","of"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Theo sits next","after":"Nova.","choices":["to","at","of"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 6, 'fill_blank', '{"before":"Theo sits next","after":"Nova.","choices":["to","at","of"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["The","ball","is","front","of","the","box."],"wrongIndex":3,"fixes":["in front","on front","at front"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["The","ball","is","front","of","the","box."],"wrongIndex":3,"fixes":["in front","on front","at front"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 7, 'find_fix', '{"words":["The","ball","is","front","of","the","box."],"wrongIndex":3,"fixes":["in front","on front","at front"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["We","are","going","the","park."],"wrongIndex":2,"fixes":["going to","going at","going on"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["We","are","going","the","park."],"wrongIndex":2,"fixes":["going to","going at","going on"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 8, 'find_fix', '{"words":["We","are","going","the","park."],"wrongIndex":2,"fixes":["going to","going at","going on"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"What does this say? Put it in order.","tiles":["Ruby","is","looking","at","the","moon."],"distractors":["to"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"What does this say? Put it in order.","tiles":["Ruby","is","looking","at","the","moon."],"distractors":["to"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 9, 'build_it', '{"prompt":"What does this say? Put it in order.","tiles":["Ruby","is","looking","at","the","moon."],"distractors":["to"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"look at the cat","group":0},{"text":"go to bed","group":0},{"text":"in front of me","group":0},{"text":"look the cat","group":1},{"text":"go at bed","group":1},{"text":"front of me","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"look at the cat","group":0},{"text":"go to bed","group":0},{"text":"in front of me","group":0},{"text":"look the cat","group":1},{"text":"go at bed","group":1},{"text":"front of me","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 10, 'sort_it', '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"look at the cat","group":0},{"text":"go to bed","group":0},{"text":"in front of me","group":0},{"text":"look the cat","group":1},{"text":"go at bed","group":1},{"text":"front of me","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 10);
update wp_questions set type = 'odd_one_out', payload = '{"prompt":"Three of these are right. Which one is not?","words":["talk to Dad","look the sky","go to the zoo","look at Pip"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'prepositions' and position = 11 and deleted_at is null and (type <> 'odd_one_out' or payload <> '{"prompt":"Three of these are right. Which one is not?","words":["talk to Dad","look the sky","go to the zoo","look at Pip"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'prepositions', 11, 'odd_one_out', '{"prompt":"Three of these are right. Which one is not?","words":["talk to Dad","look the sky","go to the zoo","look at Pip"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'prepositions' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which sentence is right?","choices":["Yesterday, I go to the zoo.","Yesterday, I went to the zoo.","Yesterday, I goed to the zoo."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which sentence is right?","choices":["Yesterday, I go to the zoo.","Yesterday, I went to the zoo.","Yesterday, I goed to the zoo."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 1, 'pick_one', '{"prompt":"Which sentence is right?","choices":["Yesterday, I go to the zoo.","Yesterday, I went to the zoo.","Yesterday, I goed to the zoo."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one is right?","choices":["Yesterday, Milo play soccer.","Yesterday, Milo played soccer.","Yesterday, Milo playing soccer."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one is right?","choices":["Yesterday, Milo play soccer.","Yesterday, Milo played soccer.","Yesterday, Milo playing soccer."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 2, 'pick_one', '{"prompt":"Which one is right?","choices":["Yesterday, Milo play soccer.","Yesterday, Milo played soccer.","Yesterday, Milo playing soccer."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["Yesterday, I see a big dog.","Yesterday, I saw a big dog.","Yesterday, I seed a big dog."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["Yesterday, I see a big dog.","Yesterday, I saw a big dog.","Yesterday, I seed a big dog."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 3, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["Yesterday, I see a big dog.","Yesterday, I saw a big dog.","Yesterday, I seed a big dog."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"Yesterday, we","after":"in the park.","choices":["play","played","playing"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Yesterday, we","after":"in the park.","choices":["play","played","playing"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 4, 'fill_blank', '{"before":"Yesterday, we","after":"in the park.","choices":["play","played","playing"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Yesterday, Pip","after":"to the store.","choices":["went","goes","go"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Yesterday, Pip","after":"to the store.","choices":["went","goes","go"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 5, 'fill_blank', '{"before":"Yesterday, Pip","after":"to the store.","choices":["went","goes","go"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"Yesterday, Otto","after":"yes.","choices":["said","says","say"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Yesterday, Otto","after":"yes.","choices":["said","says","say"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 6, 'fill_blank', '{"before":"Yesterday, Otto","after":"yes.","choices":["said","says","say"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Yesterday,","I","walk","to","school."],"wrongIndex":2,"fixes":["walked","walking","walks"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Yesterday,","I","walk","to","school."],"wrongIndex":2,"fixes":["walked","walking","walks"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 7, 'find_fix', '{"words":["Yesterday,","I","walk","to","school."],"wrongIndex":2,"fixes":["walked","walking","walks"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["Yesterday,","Theo","see","a","rainbow."],"wrongIndex":2,"fixes":["saw","seed","sees"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Yesterday,","Theo","see","a","rainbow."],"wrongIndex":2,"fixes":["saw","seed","sees"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 8, 'find_fix', '{"words":["Yesterday,","Theo","see","a","rainbow."],"wrongIndex":2,"fixes":["saw","seed","sees"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Tap the tiles in order.","tiles":["Yesterday,","we","played","in","the","snow."],"distractors":["play"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Tap the tiles in order.","tiles":["Yesterday,","we","played","in","the","snow."],"distractors":["play"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 9, 'build_it', '{"prompt":"Tap the tiles in order.","tiles":["Yesterday,","we","played","in","the","snow."],"distractors":["play"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Sort them out.","groups":["now","in the past"],"items":[{"text":"play","group":0},{"text":"played","group":1},{"text":"go","group":0},{"text":"went","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Sort them out.","groups":["now","in the past"],"items":[{"text":"play","group":0},{"text":"played","group":1},{"text":"go","group":0},{"text":"went","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 10, 'sort_it', '{"prompt":"Sort them out.","groups":["now","in the past"],"items":[{"text":"play","group":0},{"text":"played","group":1},{"text":"go","group":0},{"text":"went","group":1},{"text":"see","group":0},{"text":"saw","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 10);
update wp_questions set type = 'match_pairs', payload = '{"prompt":"Match each word to its past tense.","pairs":[{"left":"sit","right":"sat"},{"left":"sing","right":"sang"},{"left":"swim","right":"swam"},{"left":"eat","right":"ate"}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'past-tense' and position = 11 and deleted_at is null and (type <> 'match_pairs' or payload <> '{"prompt":"Match each word to its past tense.","pairs":[{"left":"sit","right":"sat"},{"left":"sing","right":"sang"},{"left":"swim","right":"swam"},{"left":"eat","right":"ate"}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'past-tense', 11, 'match_pairs', '{"prompt":"Match each word to its past tense.","pairs":[{"left":"sit","right":"sat"},{"left":"sing","right":"sang"},{"left":"swim","right":"swam"},{"left":"eat","right":"ate"}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'past-tense' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one has the capital letters and periods right?","choices":["I like milo.","i like Milo.","I like Milo."],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one has the capital letters and periods right?","choices":["I like milo.","i like Milo.","I like Milo."],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 1, 'pick_one', '{"prompt":"Which one has the capital letters and periods right?","choices":["I like milo.","i like Milo.","I like Milo."],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["otto and i are friends.","Otto and I are friends.","Otto and i are friends."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["otto and i are friends.","Otto and I are friends.","Otto and i are friends."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 2, 'pick_one', '{"prompt":"Tap the one with capitals and periods in the right places.","choices":["otto and i are friends.","Otto and I are friends.","Otto and i are friends."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which sentence starts and ends the right way?","choices":["My name is Theo.","My name is theo.","my name is Theo."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which sentence starts and ends the right way?","choices":["My name is Theo.","My name is theo.","my name is Theo."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 3, 'pick_one', '{"prompt":"Which sentence starts and ends the right way?","choices":["My name is Theo.","My name is theo.","my name is Theo."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"I play with","after":"every day.","choices":["ruby","Ruby"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I play with","after":"every day.","choices":["ruby","Ruby"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 4, 'fill_blank', '{"before":"I play with","after":"every day.","choices":["ruby","Ruby"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"Finn and","after":"like to draw.","choices":["i","I"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"Finn and","after":"like to draw.","choices":["i","I"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 5, 'fill_blank', '{"before":"Finn and","after":"like to draw.","choices":["i","I"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"","after":"has a green hat.","choices":["theo","Theo"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"","after":"has a green hat.","choices":["theo","Theo"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 6, 'fill_blank', '{"before":"","after":"has a green hat.","choices":["theo","Theo"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["Ruby","and","i","are","seven."],"wrongIndex":2,"fixes":["I","I.","i,"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["Ruby","and","i","are","seven."],"wrongIndex":2,"fixes":["I","I.","i,"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 7, 'find_fix', '{"words":["Ruby","and","i","are","seven."],"wrongIndex":2,"fixes":["I","I.","i,"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["I","sit","next","to","finn."],"wrongIndex":4,"fixes":["Finn.","Finn","finn,"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["I","sit","next","to","finn."],"wrongIndex":4,"fixes":["Finn.","Finn","finn,"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 8, 'find_fix', '{"words":["I","sit","next","to","finn."],"wrongIndex":4,"fixes":["Finn.","Finn","finn,"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build it!","tiles":["I","see","Otto","at","school."],"distractors":["otto","i"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build it!","tiles":["I","see","Otto","at","school."],"distractors":["otto","i"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 9, 'build_it', '{"prompt":"Build it!","tiles":["I","see","Otto","at","school."],"distractors":["otto","i"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"Otto","group":0},{"text":"Nova","group":0},{"text":"I can","group":0},{"text":"ruby","group":1},{"text":"finn","group":1},{"text":"i see","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"Otto","group":0},{"text":"Nova","group":0},{"text":"I can","group":0},{"text":"ruby","group":1},{"text":"finn","group":1},{"text":"i see","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 10, 'sort_it', '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"Otto","group":0},{"text":"Nova","group":0},{"text":"I can","group":0},{"text":"ruby","group":1},{"text":"finn","group":1},{"text":"i see","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"Dad and zara like soup.","right":false}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'capitals-names' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"Dad and zara like soup.","right":false}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'capitals-names', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"Dad and zara like soup.","right":false}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'capitals-names' and position = 11);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Pick the sentence that sounds right.","choices":["The cat is under of the table.","The cat is under the table.","The cat is under table."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 1 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Pick the sentence that sounds right.","choices":["The cat is under of the table.","The cat is under the table.","The cat is under table."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 1, 'pick_one', '{"prompt":"Pick the sentence that sounds right.","choices":["The cat is under of the table.","The cat is under the table.","The cat is under table."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 1);
update wp_questions set type = 'pick_one', payload = '{"prompt":"A robot wrote these. Which one is right?","choices":["The ball is next the bed.","The ball is next to the bed.","The ball is next of the bed."],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 2 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"A robot wrote these. Which one is right?","choices":["The ball is next the bed.","The ball is next to the bed.","The ball is next of the bed."],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 2, 'pick_one', '{"prompt":"A robot wrote these. Which one is right?","choices":["The ball is next the bed.","The ball is next to the bed.","The ball is next of the bed."],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 2);
update wp_questions set type = 'pick_one', payload = '{"prompt":"Which one would your teacher write?","choices":["My pencil is in the box.","My pencil is in of the box.","My pencil is of the box."],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 3 and deleted_at is null and (type <> 'pick_one' or payload <> '{"prompt":"Which one would your teacher write?","choices":["My pencil is in the box.","My pencil is in of the box.","My pencil is of the box."],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 3, 'pick_one', '{"prompt":"Which one would your teacher write?","choices":["My pencil is in the box.","My pencil is in of the box.","My pencil is of the box."],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 3);
update wp_questions set type = 'fill_blank', payload = '{"before":"I wear a hat","after":"my head.","choices":["on","in","under"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 4 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"I wear a hat","after":"my head.","choices":["on","in","under"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 4, 'fill_blank', '{"before":"I wear a hat","after":"my head.","choices":["on","in","under"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 4);
update wp_questions set type = 'fill_blank', payload = '{"before":"The floor is","after":"my feet.","choices":["on","in","under"],"answer":2}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 5 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The floor is","after":"my feet.","choices":["on","in","under"],"answer":2}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 5, 'fill_blank', '{"before":"The floor is","after":"my feet.","choices":["on","in","under"],"answer":2}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 5);
update wp_questions set type = 'fill_blank', payload = '{"before":"The milk is","after":"the cup.","choices":["on","in","under"],"answer":1}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 6 and deleted_at is null and (type <> 'fill_blank' or payload <> '{"before":"The milk is","after":"the cup.","choices":["on","in","under"],"answer":1}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 6, 'fill_blank', '{"before":"The milk is","after":"the cup.","choices":["on","in","under"],"answer":1}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 6);
update wp_questions set type = 'find_fix', payload = '{"words":["The","dog","is","next","the","door."],"wrongIndex":3,"fixes":["next to","next of","next at"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 7 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["The","dog","is","next","the","door."],"wrongIndex":3,"fixes":["next to","next of","next at"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 7, 'find_fix', '{"words":["The","dog","is","next","the","door."],"wrongIndex":3,"fixes":["next to","next of","next at"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 7);
update wp_questions set type = 'find_fix', payload = '{"words":["The","plane","is","on","the","sky."],"wrongIndex":3,"fixes":["in","at","of"],"answer":0}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 8 and deleted_at is null and (type <> 'find_fix' or payload <> '{"words":["The","plane","is","on","the","sky."],"wrongIndex":3,"fixes":["in","at","of"],"answer":0}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 8, 'find_fix', '{"words":["The","plane","is","on","the","sky."],"wrongIndex":3,"fixes":["in","at","of"],"answer":0}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 8);
update wp_questions set type = 'build_it', payload = '{"prompt":"Build the sentence.","tiles":["The","shoes","are","under","the","bed."],"distractors":["of"]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 9 and deleted_at is null and (type <> 'build_it' or payload <> '{"prompt":"Build the sentence.","tiles":["The","shoes","are","under","the","bed."],"distractors":["of"]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 9, 'build_it', '{"prompt":"Build the sentence.","tiles":["The","shoes","are","under","the","bed."],"distractors":["of"]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 9);
update wp_questions set type = 'sort_it', payload = '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"in the box","group":0},{"text":"on the desk","group":0},{"text":"next to the bed","group":0},{"text":"next the bed","group":1},{"text":"under of the chair","group":1},{"text":"in front the door","group":1}]}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 10 and deleted_at is null and (type <> 'sort_it' or payload <> '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"in the box","group":0},{"text":"on the desk","group":0},{"text":"next to the bed","group":0},{"text":"next the bed","group":1},{"text":"under of the chair","group":1},{"text":"in front the door","group":1}]}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 10, 'sort_it', '{"prompt":"Which ones are right? Sort them.","groups":["Right","Not right"],"items":[{"text":"in the box","group":0},{"text":"on the desk","group":0},{"text":"next to the bed","group":0},{"text":"next the bed","group":1},{"text":"under of the chair","group":1},{"text":"in front the door","group":1}]}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 10);
update wp_questions set type = 'right_wrong', payload = '{"prompt":"Is this sentence right?","sentence":"The bird is on the roof.","right":true}'::jsonb, updated_at = now()
  where bank_grade = 1 and skill = 'place-words' and position = 11 and deleted_at is null and (type <> 'right_wrong' or payload <> '{"prompt":"Is this sentence right?","sentence":"The bird is on the roof.","right":true}'::jsonb);
insert into wp_questions (bank_grade, skill, position, type, payload) select 1, 'place-words', 11, 'right_wrong', '{"prompt":"Is this sentence right?","sentence":"The bird is on the roof.","right":true}'::jsonb
  where not exists (select 1 from wp_questions where bank_grade = 1 and skill = 'place-words' and position = 11);

commit;
