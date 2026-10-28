"""Record the source boundaries reviewed on 28 October; never rewrite text."""
import json
from pathlib import Path

target=Path(__file__).resolve().parents[1]/'source-witnesses/phrase-selections.json'
data=json.loads(target.read_text('utf8'))

def add(sid,verse,clauses):
    record={'sourceId':sid,'passage':verse,'clauses':[
        {'units':units,'start':start,'end':end,
         'note':'Translated root clause compared with the Sanskrit; surrounding explanation excluded. Original source spelling retained; draft correspondence.'}
        for units,start,end in clauses]}
    assert not any(r['sourceId']==sid and r['passage']==verse for r in data['passages']),(sid,verse)
    data['passages'].append(record)

sid='hin_chogdub_tripathi_1972'
records={
3:[([1],'देश आदि का नियम स्वप्न की तरह','स्वप्न की तरह को'),([6,7],'तथा तों के समान',"'प्रेतों की तरह'"),([11],'सभी प्रेतों द्वारा पूयनदी','पूय (पीव )')],
4:[([1,2],'साप्नोघात के समान','जैसे-स्वप्न में'),([5,6,7],'नरक के समान सारी','नरक में (हान)'),([10],'नरकपाल आदि के दर्शन में','जैसे-नरकपाल प्रादि')],
5:[([1,2],'जिस प्रकार स्वर्ग में','जो तिर्यक् स्वर्ग में')],
6:[([1,2],'यदि उन ( नारकीयों ) के कर्मों','__ विज्ञान का ही')],
7:[([1,2],'कर्म की वासना दूसरी जगह','नारकीयों के जिस कर्म')],
8:[([2,3,4],'यह पागम कारण नहीं है',"जैसे 'उपपादुक सत्त्व")],
9:[([1,2],'जिस स्वबीज से','इस कारिका द्वारा क्या')],
10:[([1],'पुद्गलनैरात्म्य में प्रवेश ही','उस प्रकार की देशना'),([5,6],'तथा धर्मनैरात्म्य में प्रवेश',"'अन्यथा' से"),([12],'कल्पितस्वभाव धर्मों के न होने','जो पृथग-जनों')],
11:[([1,2],'वह (रूप आदि विज्ञप्तियों का विषय )','उपर्युक्त कारिका द्वारा')],
12:[([1],'छह परमाणुओं के साथ एक साथ','छह दिशाओं से'),([4,5],'छहों परमाणुओं का समान','जो एक परमाणु का देश')],
13:[([1],'तो फिर परमाणुओं का संयोग',"'वह' (सः )"),([3],'(परमाणुओं के ) निरवयव','__ यदि संघात')],
14:[([1],'जिसका दिग्भागभेद होता है','परमाणु का पूर्व दिग्भाग'),([3],'अथवा छाया और पावरण','यदि एक परमाण का'),([12],'यदि पिण्ड ( परमाणुओं से)','यदि (आप) पिण्ड को')],
15:[([1,2],'एकत्व पक्ष में क्रमिक गति','यदि (पाप) चक्षरिन्द्रिय')],
16:[([1,2],'जैसे स्वप्न आदि में प्रत्यक्ष','वह (प्रत्यक्ष बुद्धि )'),([3,4],'वह (प्रत्यक्ष बुद्धि )',"'यह मेरा प्रत्यक्ष है।")],
17:[([1],'जैसे अर्थाभासा विज्ञप्ति','जैसे विना अर्थ के'),([3],'इसके बाद स्मरण होता है','अर्थाभासवाली विज्ञप्ति के'),([9],'स्वप्न में दृष्ट विषय का प्रभाव','उसी प्रकार मिथ्या विकल्प')],
18:[([1],'अन्योऽन्य अधिपतित्व से','सभी सत्वों की अन्योऽन्य'),([7],'स्वप्न में चित्त मिद्ध से','यही ( समान फल')],
19:[([1,2],'जिस प्रकार पिशाच आदि के मन','जैसे पिशाच आदि के मनोवश')],
20:[([1],'(यदि परविज्ञप्तिविशेष से मरण','यदि दूसरों के विज्ञप्तिविशेष'),([7],'कैसे उससे मनोदण्ड','यदि आप ऐसी कल्पना')],
21:[([1],'परचित्तविद् ( अभिज्ञाप्राप्त योगियों का )','जैसे स्वचित्तज्ञान'),([2],'जैसे स्वचित्तज्ञान','वह ( स्वचित्तज्ञान )'),([3],'वह ( स्वचित्तज्ञान )','जैसे ( स्वचित्त और परचित्त ) बुद्ध'),([4],'जैसे ( स्वचित्त और परचित्त ) बुद्ध','जैसे वह ( स्वचित्त और परचित्त )')],
22:[([1,2],'मैंने अपनी शक्ति के अनुरूप','तर्क ( सविकल्प शान )'),([6],'(वह केवल ) बुद्ध की ही गोचर','वह (विज्ञप्तिमात्रता ) केवल')],
}
for verse,clauses in records.items(): add(sid,verse,clauses)

sid='eng_sharma_1993'
records={
3:[([1],'the regulation of place and time etc., is established','(The term svapna eva)')],
4:[([5,6],'“(All the previously mentioned four factors)','The term ‘siddham’')],
5:[([1,2],'“Animals are ‘born','The animals, who are born')],
6:[([1,2],'“If the (special) beings','Why not they are recognised')],
7:[([1,2],'“The impression of a deed','That type of birth')],
9:[([1,2],'wherefrom its own seed','What is being said?')],
11:[([1,2],'“(The object is experienced)','Here onwards starts')],
12:[([1],'Because if six atoms joining','If there is a combination'),([4,5],'If the six atoms belonging','Whatever is the place of one atom')],
13:[([1],'In case of not joining these atoms','The term Samyoga')],
14:[([1],'(then) an atom having a differentiation','The atom (coming)')],
15:[([1,2],'(In case whole of the earth','If the earth were to be imagined')],
17:[([1],'it has been said (already)','So it has been said:'),([3],'From it does follow the memory.','From that representation')],
18:[([1],'The law of representation of consciousness is proved by','The law of representation of consciousness of all')],
19:[([1,2],'“Death is transformation caused','Just as the loss')],
20:[([1],'“How was it that the Dandaka','If the death of other')],
22:[([1,2],'this .« of theory of consciousness','This theory of consciousness only cannot')],
}
for verse,clauses in records.items(): add(sid,verse,clauses)
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
