(() => {
  const CSV_URL = "data/pesquisadoras.csv";
  const JSON_URL = "data/dados_simcc_completo.json";
  const CAROUSEL_MIN_PHOTOS = 8;
  const CAROUSEL_PHOTO_TIMEOUT = 7_000;
  const CAROUSEL_APPROVED_PHOTO_IDS = new Set([
    "22fc7ca5-1f2f-4c66-9876-44659f00a80c",
    "5681bdab-2003-4190-b216-54d813dee72b",
    "aba7c23d-5a62-473b-9673-cde82b17dcf2",
    "73beb2e7-b3a3-4d2f-a20d-fecd4a5e8252",
    "e362adfc-fdea-4297-a780-28e1d6c5a31f",
    "d614db8d-2828-443b-bdce-f96ae381ecc2",
    "74f809eb-01b1-4a58-a4c6-4447a5e50f37",
    "5f5d05ce-77ce-4e93-a7be-00699f697f41",
    "6b62a28d-8f2c-4615-90af-ac1745e35368",
    "2954a2f0-0c28-4887-827f-2fdcccb87c6e",
    "e58250ca-1a3b-4f96-a035-0e1f94e7ff31",
    "c06d1fe4-042e-4943-af74-d5da9d2205b1",
    "e6200b31-fab3-4912-92cb-2d29be614f08",
    "13c5c075-a88e-45f6-904a-0ae5d0c3305e",
    "dd592947-b04d-4864-9b2e-e018ab0325ca",
    "2e15a8de-daec-4a37-880e-fffaa42fa9c0",
    "001d6a4c-6878-492a-b9de-79e2b5ed53d2",
    "c1047f05-0437-49a0-9374-3cb6690efd21",
    "acb48e02-1ce1-42a8-a7e8-2633fea8883a",
    "33e3839f-2930-4486-9956-77f771b1a8f8",
    "fbcff5d1-4ae1-4dbd-8752-c87028d335bb",
    "38e8af30-4b0e-4686-8e3f-52509d207c7a",
    "efcae4c0-4ef7-40ca-8384-5b7f4dcbba61",
    "487fe3e6-7918-40bc-a0ab-40799677688f",
    "d377a68b-b676-471b-9705-de01c7eaa706",
    "63324e5d-6fcb-4a6b-b1f9-65d04195fa33",
    "aa742cd0-0d92-43cb-b431-fd075b322137",
    "b6c98a73-d9cf-44dd-94e9-ec5a5c37acb4",
    "87a7bdf0-f5dd-4260-aa9f-009f8c5d5964",
    "79ce8067-ee0a-44a6-916f-b65fae586fba",
    "add72ac6-00d8-4867-ac9b-8101d17185cb",
    "152ae2d2-d3cc-4785-8bd7-a561d68da3d9",
    "46dff2f4-4bbc-4600-b281-5e9320594b73",
    "3bb02858-ab78-44de-8bdd-7635f3c62c98",
    "807025c9-4f97-4cfd-9d44-7c4d87da4af2",
    "3a2cc24a-dce5-4e79-aa3a-efe1db617e3a",
    "395e997c-f2d5-4c14-bd40-69e7965b14d8",
    "8f0fd4a9-10fa-43ae-a407-40b558787518",
    "2cf9cd11-82e0-4b62-a390-4c0839ff6af9",
    "efbfca84-cbd4-4a27-b50e-d7eaac598e92",
    "640f0060-56af-457c-b8a3-d4b7917a141a",
    "72490146-6c67-4b9f-ab53-4b6baffab9bb",
    "cc8f6d7c-ca23-49cf-b2cc-7d93cd2ba6b7",
    "7943e0ec-540c-4fb7-b423-3c5735b73862",
    "0ee947ca-9598-4fbc-a26c-f77a210c53be",
    "61d25fb9-88b9-4283-897c-2d3ee6a6f61d",
    "4750c099-b362-4df0-966e-51090dbad046",
    "160ac19a-9efc-4094-9a09-3ed083ea5b36",
    "2007249b-0086-4c0d-a59d-321e1ec1f3b7",
    "9ec2ca31-622d-4b14-b5f1-dcfefa933075",
    "138c0d38-1b35-4407-b172-88873dbdc8ed",
    "bf2f7d61-c9e9-4f9e-9bd0-d68363a84533",
    "789f403d-91df-4c1b-ae74-d20ccd45dc15",
    "b00067c2-5561-4957-b3a3-d088383f4d30",
    "aced3260-645c-47aa-a3a7-9d53f8fb439e",
    "a0b8eada-def9-4d74-a923-bec342ee4ba7",
    "21178126-d07f-46bb-88b6-7d0ab66ea622",
    "e140fe17-b818-45f1-b0ab-b952d17d51eb",
    "83fe0a3f-b7d0-4754-a4b2-c87c52f5e6c4",
    "e5050c2c-2cbe-4546-b9de-da416f932691",
    "01e60ff1-c566-401b-8630-d38f49cc6e15",
    "35a1f95f-25f3-4220-9430-a8792c3d5395",
    "b02db870-edaa-49a0-b88e-b2a336acbab2",
    "edca58b7-9954-4ffd-969a-bd37facd4f51",
    "fcf50f0e-670a-42cd-846b-4b03ad358dc8",
    "b15f78dd-a1df-4bf9-a628-237944a0f37f",
    "2a8954c7-5a78-436c-aea7-16cb51ae83b2",
    "65ae4c5f-7466-43b0-9422-49d3f5b8074b",
    "cbcb6f04-94f6-44f0-8836-fc36cfc1f682",
    "a3c52998-2fd4-4b87-8598-2eb03e8c2490",
    "9e217d92-658b-49e6-b123-e6417b7ef90e",
    "830e469e-9bb0-45ba-a5f7-a313e53ca2a1",
    "77e5357d-9764-486a-8dde-3a141b3dd70e",
    "0ce4aedb-95e3-4b4d-9fa0-69168d3b65ba",
    "a6102d3a-ece0-4cb2-a2a9-2a455df70e4d",
    "727fba54-9f28-4725-acb1-7e4632f8f36c",
    "9b684580-bc80-4c56-b576-131ca867ad00",
    "98de002d-1527-467b-88a5-995304bebc22",
    "e0ace6bb-9e54-4c03-b118-79f0cc71f5ca",
    "f735ecd5-eddb-4ab8-99d6-d25b7c6ffe3e",
    "f6a48114-f694-452d-9ba1-8cd21f7fa65a",
    "af025849-ae86-463e-9d7f-f54194006b70",
    "e041e4e7-e048-4979-8f7d-ae96314dbcdb",
    "97672cee-9c8d-43c9-b93d-49bbab560f77",
    "845630f9-93c1-4c43-8e2e-7d58f8557522",
    "b737440e-1e9c-4a05-85e8-4b6dd32fe770",
    "79e1cfc9-e774-49cc-86ea-e6dd73fbef1a",
    "efe38a95-d903-476c-97ed-2d0ac06b5f74",
    "98637077-c424-461c-8f18-2d55c14e35a2",
    "020b6f29-5ff6-45c7-9d0e-d2fa4ddb74ed",
    "9a5184f9-48bb-4c47-a345-41db22e55e69",
    "a8b176a0-3b1c-4212-a96c-b5fc89ff31e4",
    "f0d8f469-bd2e-4ca6-8647-15cd27bfad81",
    "17e89059-5c8b-483c-8747-5d5f324dae0f",
    "66554b16-a570-4aa2-9a88-97d79408fb99",
    "982baea9-2e1d-4cc8-bec1-2637a9867b37",
    "ed033206-60d6-4c8a-9e84-9633bd69b086",
    "a830f3b3-0255-46e9-814e-cc263e13124e",
    "880c5b92-15f2-4e70-adf1-24c688f18aea",
    "7b4e9238-1cbd-41d4-b0e7-d5dcdf88e329",
    "6b0bc3b0-dba4-4df5-825c-27671fe8bdd3",
    "9abb2380-7f74-48ba-a7e5-fee675883df4",
    "800ff726-203b-4a1c-b412-858e22c71dfd",
    "26e90ede-0983-425e-be76-b781b2720fe8",
    "3f20edbc-488d-4233-bc6e-e8e9b97ae906",
    "de9c271c-8f4b-4816-9e22-1984ccf22883",
    "b48bb849-ece5-46fa-a6b0-35457ac93900",
    "ce188f2d-8fab-4943-9d64-722c3ffb522c",
    // Fotos baixadas do Lattes (homens e mulheres sem foto anterior)
    "00988d31-52c6-43e3-a2a5-c6bf7c0b6fbd",
    "00b0aaeb-6fc3-48c3-a75c-d17e1f035937",
    "015514f4-d2cf-4014-be15-63763846a532",
    "0209407d-839e-48e4-8834-0694aebdf358",
    "024f7631-0721-4e67-ade1-705b882ddb92",
    "06572292-08cb-43a5-bb4f-a2b9682d8963",
    "07e2bfa6-c61e-453d-92d7-b3548e761017",
    "07f9e103-22e3-47ac-ae4d-889a636866a8",
    "09005a94-0219-4302-84bd-9273df8896ef",
    "094e4da1-e6b9-413f-939f-ad7b97c316c4",
    "0a500fea-6a6d-4601-beaa-064dc7efc89e",
    "0b135f78-3370-4f45-b25a-83f5e0fcc7fa",
    "0ba299cc-9b5b-4a50-be1b-aa7dabf8ec99",
    "0c48887a-20af-43e1-ac48-79a50e8143a8",
    "0c738ca4-e535-428f-ae23-ec98da2b989d",
    "0cf0a75d-5c33-4e0a-adf2-3617fd3e8b42",
    "0d7885ed-5293-49b7-88ed-a99e71a45013",
    "0e58f871-2ae0-48f8-95e2-34416202563f",
    "108bc006-89a3-4ad0-9188-b882f20c471b",
    "1179afa0-94bd-4048-a379-fdc5951993bc",
    "11b0020c-7f5a-4197-8180-04cbef382749",
    "12349748-a4c9-4923-8b2b-97b68f10b236",
    "14f95b40-5f54-4698-8984-1283acf2c057",
    "151c4889-41bb-4762-a2bc-22bd6878b415",
    "15526146-f87f-49da-a742-716b3fdcf321",
    "1563eddd-4c34-48e2-9b41-7c2782c5a395",
    "17227642-38bd-4e8e-83c9-74942da3c267",
    "17c3d4d2-81d8-4640-b43e-b13fe7819976",
    "185592af-5610-47bd-aa26-f2a30b2fbf3a",
    "1a03a401-482b-42bd-a04b-ff9a87c12763",
    "1d39ca48-6f92-4f4c-8a30-61c189293889",
    "1d83d9a5-7343-4110-9d29-c8eed8bbd3ca",
    "202258b7-7a31-4132-8a37-3eeebda274be",
    "206b2477-9291-473c-8324-cfd02cd7ef83",
    "21bc35b3-a3d5-4851-beaf-96704744a908",
    "24515292-49cf-4883-98f7-1d3c44807532",
    "25dadad5-e9bd-4b5a-88ea-11c402c23621",
    "271eb166-0c9f-47da-84e4-4e03fcc26fec",
    "27d246c4-dde1-4d8b-9ba7-25059c887813",
    "29c4141c-e4ba-450e-9f52-ae6196f48018",
    "2b359a81-49e9-4c9c-9ce1-23fa716fbe67",
    "2b6dc4bf-4163-4226-97f3-981cc1a75b28",
    "2b729107-2b7d-4c7c-8866-49e8daa03965",
    "2c882ade-c65c-4a67-9ce3-865d20a0af12",
    "2cf24387-bcac-4c01-813e-525dcc57ddce",
    "2d94619c-70ea-43d6-9fa8-bcf3f013d5a0",
    "2f56afe9-e993-4206-b995-6e083ffd1cb5",
    "2fbaa90b-c813-48bc-94d6-bc40ea7a71dc",
    "2fd721c8-d507-4f46-95dd-ed778eda1df3",
    "3130fa91-c282-42ed-b34d-7d6aea69b8c4",
    "35724afe-833f-45b0-97f2-58b49f63af34",
    "366bf4f6-4a48-43ea-8d94-9f0328f23614",
    "36bc5dcd-803e-47de-aa7d-facccb619848",
    "3762538f-5623-4830-82c6-408545244676",
    "379ad0e8-dcd8-4e49-815b-c0e18b420c2d",
    "38630e07-a14f-4e7d-90e7-ff6ac85f09db",
    "3891183e-86ef-4d4b-b540-08d84998b651",
    "3b52be86-cd3d-4430-bd06-b57a475d8dce",
    "3c50d1e7-4923-49c9-bac0-16f59c4c9837",
    "3c54df09-ed75-4a7a-a04d-999896e0c2ef",
    "3dcfbbc5-e313-4330-8423-8d80fd5eeaa6",
    "3e10501d-dc81-4b6a-ba6c-48b45cabb082",
    "3e39508c-1976-4370-9e98-7da75429ad36",
    "3fa0a08f-009f-4c34-b694-f74d302a4aa9",
    "3fbc5215-bb6d-4826-8297-7014bfe00849",
    "403c0581-66ce-4772-aaf7-929c20e87113",
    "4083b25a-c004-4d84-9731-d07c294294a5",
    "420c907f-dc1c-482f-9940-c2d0834ec657",
    "426f59bb-3023-436e-b846-47227f9707a2",
    "428f12d8-7255-4e75-a1a4-1e4e1174f6a9",
    "42ca5954-9a35-4689-a638-592c1c05f4ac",
    "44716860-83ed-47c3-ae34-f1e4aafd0c45",
    "455503a6-684e-400e-930e-317826684c99",
    "45c4ac80-8d7b-4fb9-95d1-511c9ea54f8b",
    "465e5c33-2f7d-4614-a25d-304a349ac964",
    "476d0e2a-6fe3-40da-814c-772778a4f6d6",
    "4ab4e071-3e1f-4eb9-8568-e75c0c04b491",
    "4b67b56d-14df-41db-8f48-9a3c47b5dac2",
    "4d71ddca-bbd3-4eb1-ab64-4bbda76a59bd",
    "4f1d7066-a952-46a3-93a6-79e0c232abca",
    "4fd821cc-d770-448f-95b1-a702f6e923f5",
    "51a91c28-8a36-41fc-80a0-43a15d881b8f",
    "5284ac07-a794-4019-9920-0f6f72e0f641",
    "566c4bf0-4fd0-4cc1-9498-c424b686f973",
    "57d754ca-d6f9-41fa-bde9-cd95ef212508",
    "5809b99a-d32b-459a-bbf6-c3ee5a0c4a38",
    "597681a2-55b4-4e75-833e-50c2033e0136",
    "59fb680d-0711-4d63-a08a-9f6dc998f4db",
    "5bb681aa-7fb1-41ae-8ec6-3c88f0a61358",
    "5c078fa4-376a-4f0d-82ca-bd1499f55aa9",
    "5dbac685-df38-48e9-8690-57f484d5ccc0",
    "5dc56075-4110-4e1f-8e73-f4fd6b9e63a7",
    "5f3cbbe6-70fe-455a-be2f-e36ab1c9f56d",
    "6041e7cc-86f0-4b02-8304-0429ac8256c5",
    "63b4b83b-10f0-4e00-ba97-e869f825ef8d",
    "65913074-d681-41cd-a5b0-5576978517f7",
    "65e20eb6-6cd7-4206-bb6e-732eb74a66a0",
    "66e31daf-66fa-4f9f-946b-aca205b0e6c9",
    "672d64a2-25f6-41fc-b182-03d097c44efe",
    "6786ec71-5645-4a77-b9fb-f889f36609c7",
    "678cd584-33a4-4a21-8b8f-3934d981f8fd",
    "68a662af-cac7-4a48-bd24-960efb1279fe",
    "6a1aaa8a-c203-400f-bb75-e6a3c0144b6a",
    "6a6e2a0a-e3a4-42d0-9851-23b99eb457a9",
    "6b3c722d-0a04-4edc-b708-a33da7f7bde9",
    "6cc6374b-abd2-4f9a-8c73-912815878c97",
    "6dfe4c62-b5b2-4d54-8288-2115e5708c7f",
    "6e7a329e-7687-4f4a-bd7a-e63e8543f140",
    "6fd1098b-6253-48c6-85ad-878bc85e48cf",
    "7029c161-f51e-4691-806c-1ed5f80d1c79",
    "71859388-f805-4146-83b8-b0891a312a19",
    "725f13ed-b9c2-44a0-ac63-5a487d74e34c",
    "727b110d-6ef3-46a2-a97d-12d0c9013001",
    "739aa799-82c6-46b2-888f-046b8bebb4d2",
    "744c42d4-9b80-4ada-8bc9-9f396091200c",
    "75ea0ac0-2d2b-4328-ae84-149fa080595d",
    "7661d8b2-a5a4-48b0-a35e-c76cf5f63271",
    "76dc97d8-a634-4a10-98ad-1f87bd9a8cd1",
    "7a7c8d11-f0d6-4d33-b46d-7523cac1a854",
    "7c6ba4f3-30ca-4020-b06e-957da8fcce43",
    "7c6c830e-0dd1-492f-bb1f-f556dc3d2cf3",
    "7d7e0234-8b29-4495-8b58-2bb1c94f2171",
    "7f75b5e5-0bc1-4caa-9ce7-5e6a5a44dd2b",
    "7fe48f4b-891b-4960-8819-f82817805f4d",
    "80dfbd2c-fad7-45b2-be08-e5774a82f7b1",
    "81758071-8050-4d1d-88ca-2eae9986f89d",
    "8233b74e-22e2-4a72-ba33-1706092defea",
    "82aca996-382c-436e-a50a-8e1d47a7530a",
    "85043363-5575-4cba-973e-64ee789a8f73",
    "86d59d4a-837b-40fe-b04c-4e765ca3c2a1",
    "874c64e8-44a0-4a7f-943b-f5490ac38a80",
    "87cb6e70-4557-4124-9f6a-a38af1ba7c4e",
    "88c4b3b6-f7b7-4ba5-8f85-f255dfe61baa",
    "88e83c3c-8c58-4e97-9140-c4b4773b2a9a",
    "8a4929d6-259f-4b2b-969d-0fb7944e586e",
    "8b46dbb8-3365-42a2-b680-f955e0f9dacf",
    "8c9e7530-76b7-4a7f-a9d7-afc3da23b822",
    "8cb5d9a1-c905-4783-9c7d-38627327d251",
    "8f361c44-0d54-4371-ace9-fff47c811d86",
    "8fa497c0-1e21-4c41-b77f-6659058aff57",
    "8fc1bc93-f073-4720-ae2d-d86284695101",
    "951ea0f3-bd5a-442c-b3a3-714b2eb544bc",
    "953b678e-43ba-4593-97e4-50310aedb48e",
    "99684405-df0a-48c7-a4f5-5f4733f34250",
    "99fb4bc8-e589-40d1-aec1-1aa2993b1188",
    "9a61db78-1c0f-4f5c-a193-096d22890bfb",
    "9a8dc1d7-a3d1-41d9-82cf-a95bea08c61f",
    "9aac6156-2868-437c-8652-fec2722cb950",
    "9d72d127-a5fd-4a6d-90c5-0359c8d20a37",
    "9ff7b5b4-edd4-4535-a708-39d609d6d88a",
    "a0209b8e-276f-4ed7-b0d4-a222929a5af9",
    "a30a11c4-4236-48a0-9fe6-6af1372aa76f",
    "a34003f5-a43e-42cb-85c6-cc5ae9c81733",
    "a34a9cb9-5749-4e77-b3e7-9151173a7da1",
    "a3d45389-4d55-4286-a839-3e8a6bc020e4",
    "a4422bc0-27f2-42aa-8650-702d6541950a",
    "a5e635b7-4220-4485-b0ec-09c7fb66f0cc",
    "a6a149dd-015b-4ae5-82e0-df5865032130",
    "a7267c68-2afa-413a-a5b2-d4e7de671419",
    "a7c9cf0d-1515-4b6c-974c-2fbf853970a9",
    "a7e8a539-f7be-4c05-bcd9-54ae756a247e",
    "a97efa8c-4fca-499b-824a-e8e6b3f852ff",
    "ab3eaaf7-9909-4ced-a8d7-a3b971ed0d82",
    "ac2f4277-4c3a-4f07-896b-a97abb346125",
    "ad90bd61-e23e-4e00-9242-44672c96d5a0",
    "adaa7c75-970c-44ed-8ae0-3154a8ed6966",
    "afa69f18-3aba-44fd-b2b6-23130f4ed239",
    "b140efc2-7992-4fe0-aff1-4f5d68786be8",
    "b1c429f5-9344-4488-a0a0-d7f5b1409bb1",
    "b1ed4349-a978-4b3c-b97b-0d238f0d60f7",
    "b2e657b3-a40f-4e66-a393-cc0aafb0d675",
    "b31c9c62-074e-4323-aa5e-88ea760dd59c",
    "b369eec5-42b8-4bbe-a915-be829261b5bb",
    "b496dd7f-407f-4ed9-8711-b897a1e964ed",
    "b62088a7-b40c-41ea-8c57-a5a11be90108",
    "b68d4c54-0327-4785-8573-4ce680add43c",
    "b70990ab-2ed7-47fe-af4a-efc796d1d610",
    "b71fdc23-ff9f-4bd2-8d2a-06d3734892b0",
    "b90d0e03-0c4c-470d-9a6c-bbb5bdd6fc49",
    "b97020fc-d579-440c-9a60-59ca98d89668",
    "ba350d83-743b-4b89-8975-b9ef92cb5303",
    "ba5a5623-6655-4605-84cb-c52b1c6e0541",
    "bb5e52df-d88f-4beb-bac4-ac5b49dc74ee",
    "bc0f3377-1932-4ea4-a11d-a6e300ba3ca2",
    "bc29d892-7465-4e7b-aaa0-4d1f860a9035",
    "bc3c5a3e-68bf-4a00-92f8-27fadd0b50b2",
    "be1e8c8b-223c-45c4-aca0-40571880b237",
    "bf867f7a-671b-4a99-9d64-0aa230155d63",
    "bffd36ae-0aa9-4cff-a85d-f97d9270c404",
    "c0b5ba51-a0ab-4a52-8de4-0e01036fbe46",
    "c30505b5-6645-4c67-a5f8-ac1966bb29f7",
    "c38de5fd-885a-46ee-8ffb-788f5f594fc1",
    "c3ea6368-c31a-439c-9fa1-d22234b4d1d5",
    "c4da3c95-604b-4472-bb4e-fa9dac65e6e1",
    "c511c089-3c49-489a-9fc0-0fbf34a146eb",
    "c633d542-d490-4f36-909a-7542dd3cd68e",
    "c68deca3-a9c8-4643-a681-db81bc8821d8",
    "c72a7ea6-b4d4-48c2-bb7f-2676c9c95735",
    "c7419e80-803d-476f-8f59-6c7bbe5d97b3",
    "c749c5eb-af13-4182-ad49-d1a96b3f8f93",
    "c7bd188a-6309-49f7-b1b9-6a44726efa39",
    "c8eff8ff-2e28-4c71-8109-69ab7a4946fd",
    "ca880416-1ba0-4959-8342-39c34e43e9fc",
    "cce7db66-5880-4d1d-b193-54c46d389ae2",
    "cd75d5eb-8ca3-465d-9937-3c87b343e5b1",
    "ce2151e9-f487-422c-924a-fe24ff89350d",
    "ceb91677-a061-40f7-9f66-1f6ffda38d25",
    "cf2c47d1-c3e5-4f1b-9872-4691de56f6e1",
    "cfa4dce5-749d-4e26-9dfc-c911457af9e6",
    "d0221040-c26e-443e-a016-bc8d27c2591b",
    "d1b6f466-cf32-450b-be22-21c0914d83d9",
    "d2b1dc66-8720-405f-a859-0ab41270d666",
    "d4eeb9b4-e0ae-4263-ba47-c0ef74b5232f",
    "d5205a97-2c52-46d9-ba27-fcddf4467ea4",
    "d572fa14-9188-4c9d-9da7-b19920565d13",
    "d6da3500-9f9a-4e5a-9d93-1fa1a7fe305a",
    "d74849bc-c9fa-409f-8c72-f61036e9926c",
    "d7b3f7fb-54d1-4450-a10d-a8886829e5a1",
    "d8274363-6700-4ca4-a663-4bcdb6461e40",
    "d904ca85-5655-4688-808e-ca6febc5eab5",
    "db2e6fec-9dc0-47a1-add0-82409d71259a",
    "dba4b332-d63d-4c94-83b4-fef818d1c38b",
    "dc62965e-481c-4a79-9e93-197c1efc3249",
    "dcc68122-b9d9-41ec-9851-ab6f94f87d27",
    "ddb0677b-bea1-448c-8b05-874426e53fec",
    "de46055f-f778-4526-aed9-8a5b359941ad",
    "e0e0d6a5-e1eb-46ce-ae66-f76741a2eb67",
    "e1775fa8-20d4-45ba-ba3f-5f0fb87916a6",
    "e3558ce9-f1d8-47fc-96c6-f31528f33771",
    "e3781b48-701a-47d7-8981-b6c82fba599a",
    "e5be1bc4-f948-4d1c-88e0-7ef01f9002db",
    "e5f5a764-946f-414f-80ff-4be35a67d753",
    "e8a876d2-a01b-4026-8a23-aec5c2de370b",
    "e9bbce77-c6f0-4eee-8382-670e59a0de9c",
    "e9c61830-585e-45ff-8047-614c1b690185",
    "ea2cf9d4-1392-4fc8-b220-9acd0a2f5f8c",
    "ea37e663-9ee1-44e5-93a6-4b3fdea021de",
    "ea595056-94f2-4a4f-9f29-035184e9249a",
    "eb483f23-4bd1-4b5d-aa26-adc1e49180d7",
    "ec8b9e90-226d-42c8-8698-cbf86aefe6c7",
    "ed3479de-e9f5-4ea1-9d45-dc524e871542",
    "ee96ecae-1f0e-4371-86cb-151082c10633",
    "eeb06547-50b6-4220-a312-428faf128ade",
    "f0e3fdac-fd0a-4d7a-bd2f-4f69bde6fd33",
    "f1fe99e2-1f89-4c97-93b6-8f78e35623a7",
    "f27fc2fa-c340-4e6e-9da0-08b861ba0c0a",
    "f29b64cd-c95b-49c0-aef4-0e3016727224",
    "f2c58270-3a1a-49fe-8dd8-1e9b63455595",
    "f5c523ee-76b7-4a5a-8939-9bada6dc86df",
    "f740c81c-4bc2-4ccf-a0a7-533f25b58dac",
    "f8bca0c0-89ad-4021-be33-d51eb4507974",
    "fad5d761-d928-4ce9-a62f-5c0933eb9ffc",
    "fd107bb0-4803-406a-899e-ececdb9ad425",
    "fd73dea1-022d-494c-af19-0d89b4a849d9",
    "ff206389-b1c4-4b90-9ee9-3d4649956a31"
  ]);
  const cards = [...document.querySelectorAll(".nav-card")];
  const attraction = document.querySelector("#attraction");
  const attractionButton = attraction.querySelector(".attraction__button");
  const touchFeedback = document.querySelector(".touch-feedback");
  const discoveryTransition = document.querySelector("#discovery-transition");
  const carouselTrack = document.querySelector("[data-scientist-carousel]");
  const routes = {
    cientistas: "cientistas.html",
    tematicas: "tematicas.html",
    numeros: "numeros.html"
  };
  let lastFocusedElement = null;

  const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);

  const validText = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text && !["null", "undefined", "nan"].includes(text.toLowerCase()) ? text : null;
  };

  const normalizeKey = (value) => String(value || "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const initials = (name = "") => name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];

      if (character === '"') {
        if (quoted && next === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (character === "," && !quoted) {
        row.push(value);
        value = "";
        continue;
      }

      if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(value);
        if (row.some((cell) => validText(cell))) rows.push(row);
        row = [];
        value = "";
        continue;
      }

      value += character;
    }

    if (value || row.length) {
      row.push(value);
      if (row.some((cell) => validText(cell))) rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows.shift().map(normalizeKey);
    return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const next = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[next]] = [copy[next], copy[index]];
    }
    return copy;
  }

  function photoURL(researcher) {
    if (CAROUSEL_APPROVED_PHOTO_IDS.has(researcher.id)) return `assets/carousel/${researcher.id}.webp`;
    const image = validText(researcher.imagem);
    if (image && /^(https?:|data:|assets\/)/i.test(image)) return image;
    const lattes10Id = validText(researcher.lattes_10_id);
    return lattes10Id
      ? `https://servicosweb.cnpq.br/wspessoa/servletrecuperafoto?tipo=1&id=${encodeURIComponent(lattes10Id)}`
      : null;
  }

  function preloadCarouselPhoto(researcher) {
    const photo = photoURL(researcher);
    if (!photo) return Promise.resolve(null);

    return new Promise((resolve) => {
      const image = new Image();
      const timer = window.setTimeout(() => resolve(null), CAROUSEL_PHOTO_TIMEOUT);

      image.onload = () => {
        window.clearTimeout(timer);
        resolve(image.naturalWidth >= 40 && image.naturalHeight >= 40 ? { ...researcher, carouselPhoto: photo } : null);
      };

      image.onerror = () => {
        window.clearTimeout(timer);
        resolve(null);
      };

      image.decoding = "async";
      image.src = photo;
    });
  }

  function carouselCardMarkup(researcher) {
    const name = validText(researcher.nome) || "Cientista";
    const institution = validText(researcher.sigla) || validText(researcher.instituicao) || "Bahia";

    return `<a class="scientist-carousel__card" href="perfil.html?id=${encodeURIComponent(researcher.id)}" aria-label="Ver perfil de ${escapeHTML(name)}">
      <img src="${escapeHTML(researcher.carouselPhoto)}" alt="" loading="eager" decoding="async" />
      <span class="scientist-carousel__caption">
        <strong>${escapeHTML(name)}</strong>
        <span>${escapeHTML(institution)}</span>
      </span>
    </a>`;
  }

  // Lê o JSON completo (homens e mulheres); se falhar, usa o CSV.
  async function loadCarouselRecords() {
    try {
      const response = await fetch(JSON_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Falha ao carregar JSON (${response.status})`);
      const payload = await response.json();
      const records = Array.isArray(payload) ? payload : payload.data || [];
      return records.map((record) => ({
        id: record.id,
        nome: record.name,
        lattes_10_id: record.lattes_10_id,
        sigla: record["SIGLA IA"] || record.institution?.acronym,
        instituicao: record.university || record.institution?.name,
        imagem: record.image || record.image_url
      }));
    } catch (error) {
      console.warn("JSON indisponível para o carrossel, usando CSV:", error);
      const response = await fetch(CSV_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Falha ao carregar CSV (${response.status})`);
      return parseCSV(await response.text());
    }
  }

  async function initializeScientistCarousel() {
    if (!carouselTrack) return;

    try {
      const researchers = (await loadCarouselRecords())
        .filter((item) => validText(item.id)
          && validText(item.nome)
          && validText(item.lattes_10_id)
          && CAROUSEL_APPROVED_PHOTO_IDS.has(item.id));
      const candidates = shuffle(researchers).slice(0, 48);
      const loaded = (await Promise.all(candidates.map(preloadCarouselPhoto))).filter(Boolean).slice(0, 18);
      if (loaded.length < CAROUSEL_MIN_PHOTOS) throw new Error("Poucas fotos carregadas para o carrossel");

      carouselTrack.innerHTML = [...loaded, ...loaded].map(carouselCardMarkup).join("");
      carouselTrack.classList.add("is-ready");
    } catch (error) {
      console.warn("Não foi possível montar o carrossel de pesquisadoras:", error);
      carouselTrack.remove();
    }
  }

  function initializeHeroPhotoRotation() {
    const heroPhotos = [...document.querySelectorAll("[data-hero-photo]")];
    if (!heroPhotos.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const visibleIds = new Set(heroPhotos.map((image) => image.dataset.photoId).filter(Boolean));
    let photoDeck = shuffle([...CAROUSEL_APPROVED_PHOTO_IDS]);
    let slotIndex = 0;
    let isSwapping = false;

    const nextAvailableId = () => {
      if (!photoDeck.length) photoDeck = shuffle([...CAROUSEL_APPROVED_PHOTO_IDS]);

      let attempts = photoDeck.length;
      while (attempts > 0) {
        const candidate = photoDeck.shift();
        if (candidate && !visibleIds.has(candidate)) return candidate;
        if (candidate) photoDeck.push(candidate);
        attempts -= 1;
      }
      return null;
    };

    const swapPhoto = () => {
      if (document.hidden || isSwapping) return;

      const nextId = nextAvailableId();
      if (!nextId) return;

      const target = heroPhotos[slotIndex];
      const previousId = target.dataset.photoId;
      const nextSource = `assets/carousel/${nextId}.webp`;
      const preloader = new Image();
      isSwapping = true;

      preloader.onload = () => {
        target.classList.add("is-changing");

        window.setTimeout(() => {
          let revealTimer;
          const reveal = () => {
            window.clearTimeout(revealTimer);
            target.classList.remove("is-changing");
            isSwapping = false;
          };

          target.addEventListener("load", reveal, { once: true });
          target.addEventListener("error", reveal, { once: true });

          target.src = nextSource;
          target.dataset.photoId = nextId;
          visibleIds.delete(previousId);
          visibleIds.add(nextId);
          slotIndex = (slotIndex + 1) % heroPhotos.length;
          revealTimer = window.setTimeout(reveal, 900);
        }, 300);
      };

      preloader.onerror = () => {
        isSwapping = false;
      };

      preloader.decoding = "async";
      preloader.src = nextSource;
    };

    window.setInterval(swapPhoto, 3200);
  }

  const hideAttraction = () => {
    attraction.classList.remove("is-visible");
    attraction.setAttribute("aria-hidden", "true");

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  };

  const animateTouch = (event) => {
    const point = event.touches?.[0] ?? event;
    if (typeof point.clientX !== "number") return;

    touchFeedback.style.left = `${point.clientX}px`;
    touchFeedback.style.top = `${point.clientY}px`;
    touchFeedback.classList.remove("is-active");
    void touchFeedback.offsetWidth;
    touchFeedback.classList.add("is-active");
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const { section } = card.dataset;
      card.classList.add("is-pressed");
      window.setTimeout(() => card.classList.remove("is-pressed"), 280);
      console.log("Abrir seção:", section);

      if (section === "descubra") {
        discoveryTransition.classList.add("is-visible");
        window.setTimeout(() => { window.location.href = "perfil.html?descubra=1"; }, 720);
        return;
      }

      if (routes[section]) window.location.href = routes[section];
    });
  });

  attractionButton.addEventListener("click", () => {
    hideAttraction();
  });

  attraction.addEventListener("click", (event) => {
    if (event.target === attraction) attractionButton.click();
  });

  document.addEventListener("pointerdown", animateTouch, { passive: true });

  window.addEventListener("load", () => {
    document.body.classList.add("is-ready");
    initializeScientistCarousel();
    initializeHeroPhotoRotation();
  });
})();
