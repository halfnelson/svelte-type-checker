<></>;function render() {

	let count = 0;

	function handleClick(b: number) {
		count += b;
	}
;
<>

<button onclick={handleClick}>
	Clicked {count} {count === 1 ? 'time' : 'times'}
</button></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}